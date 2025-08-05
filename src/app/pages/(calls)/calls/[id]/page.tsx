'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { useUser } from '@/context/UserContext';
import CallControls from '@/components/CallControls';
import { 
  GET_CALL, 
  ANSWER_CALL, 
  END_CALL, 
  ADD_ICE_CANDIDATE, 
  ICE_CANDIDATE_SUBSCRIPTION, 
  CALL_ANSWERED_SUBSCRIPTION, 
  CALL_ENDED_SUBSCRIPTION,
  START_CALL // Import the START_CALL mutation
} from '@/graphql/query/callquery';

export default function CallPage() {
  const router = useRouter();
  const { receiverId } = useParams();
  const { user } = useUser();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [callStatus, setCallStatus] = useState<string>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isNewCall, setIsNewCall] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Queries and Mutations
  const { data, loading, error: queryError, refetch } = useQuery(GET_CALL, {
    variables: { receiverId },
    skip: !receiverId || isNewCall, // Skip if it's a new call being created
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });
  
  const [answerCall] = useMutation(ANSWER_CALL);
  const [endCall] = useMutation(END_CALL);
  const [addIceCandidate] = useMutation(ADD_ICE_CANDIDATE);
  const [startCall] = useMutation(START_CALL); // Add startCall mutation

  // Enhanced WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.services.mozilla.com" },
      { urls: "stun:stun.softjoys.com:3478" }
    ],
    iceCandidatePoolSize: 10
  };

  // Check if this is a new call (when id is actually receiverId)
  useEffect(() => {
    if (!receiverId || !user) return;
    
    // If id doesn't look like a call ID (UUID), treat it as receiverId for new call
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiverId as string);
    
    if (!isUUID) {
      setIsNewCall(true);
      handleStartNewCall(receiverId as string);
    } else {
      setIsNewCall(false);
    }
  }, [receiverId, user]);

  // Function to start a new call
  const handleStartNewCall = async (receiverId: string) => {
    try {
      console.log('Starting new call to user:', receiverId);
      setCallStatus('initiating');
      
      const { data: callData } = await startCall({
        variables: {
          input: {
            receiverId: receiverId
          }
        }
      });
      
      if (callData?.startCall?.call) {
        console.log('Call created successfully:', callData.startCall.call.id);
        // Redirect to the actual call page with the call ID
        router.replace(`/call/${callData.startCall.call.id}`);
      }
    } catch (err) {
      console.error('Error starting call:', err);
      setError('Failed to start call. Please try again.');
      setCallStatus('error');
    }
  };
  
  // Initialize WebRTC - only for existing calls, not new ones
  useEffect(() => {
    if (!receiverId || !user || isInitialized || isNewCall) return;
    
    console.log('Initializing WebRTC for call:', receiverId, 'user:', user.id);
    
    const initWebRTC = async () => {
      try {
        setCallStatus('initializing');
        
        // Get user media with better constraints
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }, 
          video: false 
        });
        
        console.log('Got local stream:', stream.getTracks().length, 'tracks');
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Create peer connection with enhanced config
        const pc = new RTCPeerConnection(rtcConfiguration);
        setPeerConnection(pc);
        
        // Add local stream to connection
        stream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind);
          pc.addTrack(track, stream);
        });
        
        // Handle remote stream
        pc.ontrack = (event) => {
          console.log('Received remote track:', event.track.kind);
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
            console.log('Generated ICE candidate:', event.candidate.type);
            addIceCandidate({
              variables: {
                input: {
                  callId: receiverId,
                  candidate: JSON.stringify(event.candidate)
                }
              }
            }).catch(err => console.error('Failed to add ICE candidate:', err));
          }
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          console.log('Connection state changed:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setCallStatus('connected');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallStatus('disconnected');
            setTimeout(() => handleEndCall(), 5000);
          }
        };

        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'failed') {
            console.log('ICE connection failed, restarting...');
            pc.restartIce();
          }
        };
        
        setIsInitialized(true);
        setCallStatus('initialized');
        
        // Wait for call data to be available
        if (data?.getCall) {
          await handleCallData(pc);
        }
        
      } catch (err) {
        console.error('Error initializing WebRTC:', err);
        setError('Failed to initialize call. Please check your microphone permissions and try again.');
        setCallStatus('error');
      }
    };
    
    initWebRTC();
    
    return () => {
      console.log('Cleaning up WebRTC resources');
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [receiverId, user, isInitialized, isNewCall, data]);

  // Handle call data when available
  const handleCallData = async (pc: RTCPeerConnection) => {
    if (!data?.getCall || !user) return;
    
    const call = data.getCall;
    const isCaller = call.caller?.id === user.id;
    
    console.log('Handling call data. Is caller:', isCaller, 'Call status:', call.status);
    
    if (isCaller && call.status === 'INITIATED') {
      // Caller creates offer
      try {
        console.log('Creating offer...');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        console.log('Offer created and set as local description');
        
        // TODO: Send offer through your signaling mechanism
        // You might need to add a mutation to send the SDP offer
        setCallStatus('calling');
      } catch (err) {
        console.error('Error creating offer:', err);
        setError('Failed to create call offer');
      }
    } else if (!isCaller && call.status === 'INITIATED') {
      setCallStatus('ringing');
    }
  };

  // Effect to handle call data updates - only for existing calls
  useEffect(() => {
    if (data?.getCall && peerConnection && isInitialized && !isNewCall) {
      handleCallData(peerConnection);
    }
  }, [data, peerConnection, isInitialized, isNewCall]);
  
  // Subscriptions - only for existing calls
  useSubscription(ICE_CANDIDATE_SUBSCRIPTION, {
    variables: { callId: receiverId },
    onData: ({ data }) => {
      if (data.data?.iceCandidateReceived && peerConnection) {
        try {
          const candidate = JSON.parse(data.data.iceCandidateReceived.candidate);
          console.log('Received ICE candidate:', candidate.type);
          peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    },
    skip: !receiverId || !peerConnection || isNewCall
  });
  
  useSubscription(CALL_ANSWERED_SUBSCRIPTION, {
    variables: { callId: receiverId },
    onData: ({ data }) => {
      if (data.data?.callAnswered) {
        console.log('Call answered');
        setCallStatus('connected');
      }
    },
    skip: !receiverId || isNewCall
  });
  
  useSubscription(CALL_ENDED_SUBSCRIPTION, {
    variables: { callId: receiverId },
    onData: ({ data }) => {
      if (data.data?.callEnded) {
        console.log('Call ended remotely');
        handleEndCall();
      }
    },
    skip: !receiverId || isNewCall
  });
  
 const handleAnswerCall = async () => {
  try {
    if (!peerConnection) {
      console.error('No peer connection available');
      setError('Call connection not ready yet. Please wait...');
      return;
    }
    
    if (callStatus !== 'ringing') {
      console.error('Call is not in ringing state');
      return;
    }
    
    console.log('Answering call...');
    setCallStatus('answering');
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    await answerCall({
      variables: {
        input: {
          callId: receiverId,
          sdpAnswer: JSON.stringify(answer)
        }
      }
    });
    
    console.log('Call answered successfully');
    setCallStatus('connected');
  } catch (err) {
    console.error('Error answering call:', err);
    setError('Failed to answer call');
    setCallStatus('error');
  }
};
  
  const handleEndCall = async () => {
    try {
      console.log('Ending call...');
      
      if (receiverId && !isNewCall) {
        await endCall({
          variables: {
            input: {
              callId: receiverId
            }
          }
        });
      }
      
      // Clean up resources
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
      
      // Navigate back
      router.push('/');
      
    } catch (err) {
      console.error('Error ending call:', err);
      // Still navigate away even if the mutation fails
      router.push('/');
    }
  };

  // Add retry mechanism for failed calls
  const handleRetry = () => {
    setError(null);
    setIsInitialized(false);
    setCallStatus('connecting');
    if (!isNewCall) {
      refetch();
    }
  };
  
  // Show loading state for new calls
  if (isNewCall && callStatus === 'initiating') {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Starting call...</div>
        </div>
      </div>
    );
  }
  
  if (loading && !data && !isNewCall) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Loading call...</div>
        </div>
      </div>
    );
  }
  
  if (queryError && !data && !isNewCall) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-xl text-red-600 mb-4">
            Error loading call: {queryError.message}
          </div>
          <button 
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-xl text-red-600 mb-4">Error: {error}</div>
          <button 
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  const call = data?.getCall;
  const isCaller = call?.caller?.id === user?.id;
  const otherUser = isCaller ? call?.receiver : call?.caller;
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-4">
          {isCaller ? 'Calling' : 'Incoming call from'} {otherUser?.firstName} {otherUser?.lastName}
        </h1>
        
        <div className="mb-4 text-center">
          <div className="text-lg font-semibold capitalize">
            Status: {callStatus}
          </div>
          {callStatus === 'connecting' && (
            <div className="text-sm text-gray-600 mt-1">
              Initializing call...
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-8">
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="text-center mb-2">You</h3>
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline
              className="w-full h-48 bg-black rounded"
            />
          </div>
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="text-center mb-2">{otherUser?.firstName}</h3>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline
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