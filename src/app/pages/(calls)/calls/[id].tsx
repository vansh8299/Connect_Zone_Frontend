import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { useUser } from '@/context/UserContext';
import CallControls from '@/components/CallControls';
import { GET_CALL, ANSWER_CALL, END_CALL, ADD_ICE_CANDIDATE, ICE_CANDIDATE_SUBSCRIPTION, CALL_ANSWERED_SUBSCRIPTION, CALL_ENDED_SUBSCRIPTION } from '@/graphql/query/callquery';



export default function CallPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [callStatus, setCallStatus] = useState<string>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const { data, loading } = useQuery(GET_CALL, {
    variables: { id },
    skip: !id
  });
  
  const [answerCall] = useMutation(ANSWER_CALL);
  const [endCall] = useMutation(END_CALL);
  const [addIceCandidate] = useMutation(ADD_ICE_CANDIDATE);
  
  // Initialize WebRTC
  useEffect(() => {
    if (!id || !user) return;
    
    const initWebRTC = async () => {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // Add your TURN servers here if needed
          ]
        });
        setPeerConnection(pc);
        
        // Add local stream to connection
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
        
        // Handle remote stream
        pc.ontrack = (event) => {
          const remoteStream = new MediaStream();
          event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
          });
          setRemoteStream(remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            addIceCandidate({
              variables: {
                input: {
                  callId: id,
                  candidate: JSON.stringify(event.candidate)
                }
              }
            });
          }
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setCallStatus('connected');
          } else if (pc.connectionState === 'disconnected') {
            handleEndCall();
          }
        };
        
        // If we're the caller, create offer
        if (data?.getCall?.caller?.id === user.id) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // Here you would send the offer to the other peer via your signaling server
        }
        
      } catch (err) {
        console.error('Error initializing WebRTC:', err);
        setError('Failed to initialize call. Please check your microphone permissions.');
      }
    };
    
    initWebRTC();
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [id, user, data]);
  
  // Handle incoming ICE candidates
  useSubscription(ICE_CANDIDATE_SUBSCRIPTION, {
    variables: { callId: id },
    onData: ({ data }) => {
      if (data.data?.iceCandidateReceived && peerConnection) {
        const candidate = JSON.parse(data.data.iceCandidateReceived.candidate);
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  });
  
  // Handle call answered
  useSubscription(CALL_ANSWERED_SUBSCRIPTION, {
    variables: { callId: id },
    onData: ({ data }) => {
      if (data.data?.callAnswered) {
        setCallStatus('connected');
      }
    }
  });
  
  // Handle call ended
  useSubscription(CALL_ENDED_SUBSCRIPTION, {
    variables: { callId: id },
    onData: ({ data }) => {
      if (data.data?.callEnded) {
        handleEndCall();
      }
    }
  });
  
  const handleAnswerCall = async () => {
    try {
      if (!peerConnection) return;
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      await answerCall({
        variables: {
          input: {
            callId: id,
            sdpAnswer: JSON.stringify(answer)
          }
        }
      });
      
      setCallStatus('connected');
    } catch (err) {
      console.error('Error answering call:', err);
      setError('Failed to answer call');
    }
  };
  
  const handleEndCall = async () => {
    try {
      await endCall({
        variables: {
          input: {
            callId: id
          }
        }
      });
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
      
      router.push('/calls');
    } catch (err) {
      console.error('Error ending call:', err);
      setError('Failed to end call');
    }
  };
  
  if (loading) return <div>Loading call...</div>;
  if (error) return <div>Error: {error}</div>;
  
  const call = data?.getCall;
  const isCaller = call?.caller?.id === user?.id;
  const otherUser = isCaller ? call?.receiver : call?.caller;
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-4">
          {isCaller ? 'Calling' : 'Incoming call from'} {otherUser?.firstName} {otherUser?.lastName}
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-8">
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="text-center mb-2">You</h3>
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              className="w-full h-48 bg-black rounded"
            />
          </div>
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="text-center mb-2">{otherUser?.firstName}</h3>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              className="w-full h-48 bg-black rounded"
            />
          </div>
        </div>
        
        <CallControls 
          status={callStatus}
          isCaller={isCaller}
          onAnswer={handleAnswerCall}
          onEnd={handleEndCall}
        />
      </div>
    </div>
  );
}