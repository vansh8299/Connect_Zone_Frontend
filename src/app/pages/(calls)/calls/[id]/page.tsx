'use client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  START_CALL
} from '@/graphql/query/callquery';

export default function CallPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useUser();
  
  const getCallIdOrReceiverId = () => {
    if (params.id === 'new') {
      return searchParams.get('receiverId');
    }
    return params.id as string;
  };
  
  const callIdOrReceiverId = getCallIdOrReceiverId();
  console.log('CallPage - callIdOrReceiverId:', callIdOrReceiverId);
  console.log('Route params:', params);
  console.log('Search params:', Object.fromEntries(searchParams.entries()));
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [callStatus, setCallStatus] = useState<string>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isNewCall, setIsNewCall] = useState(false);
  const [actualCallId, setActualCallId] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Determine if this is a UUID (existing call) or receiverId (new call)
  const isUUID = (str: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  };
  
  // Set up queries and mutations based on call type
  const { data, loading, error: queryError, refetch } = useQuery(GET_CALL, {
    variables: { id: actualCallId || callIdOrReceiverId },
    skip: !callIdOrReceiverId || isNewCall || (!actualCallId && !isUUID(callIdOrReceiverId || '')),
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });
  
  console.log('Call data:', data);
  const [answerCall] = useMutation(ANSWER_CALL);
  const [endCall] = useMutation(END_CALL);
  const [addIceCandidate] = useMutation(ADD_ICE_CANDIDATE);
  const [startCall] = useMutation(START_CALL);

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

  // Check if this is a new call or existing call
  useEffect(() => {
    if (!callIdOrReceiverId || !user) return;
    
    // If route is /call/new, this is definitely a new call
    if (params.id === 'new') {
      console.log('New call route detected');
      setIsNewCall(true);
      handleStartNewCall(callIdOrReceiverId);
      return;
    }
    
    // Check if it's a UUID (existing call) or receiverId (new call)
    if (isUUID(callIdOrReceiverId)) {
      console.log('Existing call ID detected:', callIdOrReceiverId);
      setIsNewCall(false);
      setActualCallId(callIdOrReceiverId);
    } else {
      console.log('Receiver ID detected, starting new call to:', callIdOrReceiverId);
      setIsNewCall(true);
      handleStartNewCall(callIdOrReceiverId);
    }
  }, [callIdOrReceiverId, user, params.id]);

  const handleStartNewCall = async (receiverId: string) => {
    try {
      console.log('=== Starting new call ===');
      console.log('Receiver ID:', receiverId);
      console.log('Current user:', user);
      
      if (!receiverId) {
        throw new Error('Receiver ID is required');
      }
      
      if (!user?.id) {
        throw new Error('You must be logged in to make a call');
      }
      
      if (receiverId === user.id) {
        throw new Error('You cannot call yourself');
      }
      
      setCallStatus('initiating');
      setError(null);
      
      console.log('Calling startCall mutation...');
      
      const result = await startCall({
        variables: {
          input: {
            receiverId: receiverId
          }
        },
        errorPolicy: 'all'
      });
      
      console.log('StartCall result:', result);
      
      if (result.errors && result.errors.length > 0) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(result.errors[0].message);
      }
      
      if (!result.data?.startCall?.call) {
        throw new Error('Call could not be created');
      }
      
      const newCall = result.data.startCall.call;
      console.log('Call created successfully:', newCall.id);
      
      // Set the actual call ID and switch to existing call mode
      setActualCallId(newCall.id);
      setIsNewCall(false);
      setCallStatus('calling');
      
      // Update URL without reload
      window.history.replaceState(null, '', `/pages/calls/${newCall.id}`);
      
    } catch (err) {
      console.error('=== Error starting call ===', err);
      
      let errorMessage = 'Failed to start call';
      if (err instanceof Error) {
        if (err.message.includes('Receiver not found')) {
          errorMessage = 'The user you are trying to call was not found';
        } else if (err.message.includes('Cannot call yourself')) {
          errorMessage = 'You cannot call yourself';
        } else if (err.message.includes('already exists')) {
          errorMessage = 'There is already an ongoing call with this user';
        } else if (err.message.includes('logged in')) {
          errorMessage = 'You must be logged in to make a call';
        } else if (err.message) {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setCallStatus('error');
    }
  };
  
  // Initialize WebRTC - only for existing calls
  useEffect(() => {
    if (!actualCallId || !user || isInitialized || isNewCall) return;
    
    console.log('Initializing WebRTC for call:', actualCallId, 'user:', user.id);
    
    const initWebRTC = async () => {
      try {
        setCallStatus('initializing');
        
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
        
        const pc = new RTCPeerConnection(rtcConfiguration);
        setPeerConnection(pc);
        
        stream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind);
          pc.addTrack(track, stream);
        });
        
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
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Generated ICE candidate:', event.candidate.type);
            addIceCandidate({
              variables: {
                input: {
                  callId: actualCallId,
                  candidate: JSON.stringify(event.candidate)
                }
              }
            }).catch(err => console.error('Failed to add ICE candidate:', err));
          }
        };
        
        pc.onconnectionstatechange = () => {
          console.log('Connection state changed:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setCallStatus('connected');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setCallStatus('disconnected');
            setTimeout(() => handleEndCall(), 5000);
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'failed') {
            console.log('ICE connection failed, restarting...');
            pc.restartIce();
          }
        };
        
        setIsInitialized(true);
        setCallStatus('initialized');
        
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
  }, [actualCallId, user, isInitialized, isNewCall, data]);

  // Handle call data when available
  const handleCallData = async (pc: RTCPeerConnection) => {
    if (!data?.getCall || !user) return;
    
    const call = data.getCall;
    const isCaller = call.caller?.id === user.id;
    
    console.log('Handling call data. Is caller:', isCaller, 'Call status:', call.status);
    
    if (isCaller && call.status === 'INITIATED') {
      try {
        console.log('Creating offer...');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        console.log('Offer created and set as local description');
        
        setCallStatus('calling');
      } catch (err) {
        console.error('Error creating offer:', err);
        setError('Failed to create call offer');
      }
    } else if (!isCaller && call.status === 'INITIATED') {
      setCallStatus('ringing');
    }
  };

  // Effect to handle call data updates
  useEffect(() => {
    if (data?.getCall && peerConnection && isInitialized && !isNewCall) {
      handleCallData(peerConnection);
    }
  }, [data, peerConnection, isInitialized, isNewCall]);
  
  // Subscriptions - only for existing calls
  useSubscription(ICE_CANDIDATE_SUBSCRIPTION, {
    variables: { callId: actualCallId },
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
    skip: !actualCallId || !peerConnection || isNewCall
  });
  
  useSubscription(CALL_ANSWERED_SUBSCRIPTION, {
    variables: { callId: actualCallId },
    onData: ({ data }) => {
      if (data.data?.callAnswered) {
        console.log('Call answered');
        setCallStatus('connected');
      }
    },
    skip: !actualCallId || isNewCall
  });
  
  useSubscription(CALL_ENDED_SUBSCRIPTION, {
    variables: { callId: actualCallId },
    onData: ({ data }) => {
      if (data.data?.callEnded) {
        console.log('Call ended remotely');
        handleEndCall();
      }
    },
    skip: !actualCallId || isNewCall
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
            callId: actualCallId,
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
      
      if (actualCallId && !isNewCall) {
        await endCall({
          variables: {
            input: {
              callId: actualCallId
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

  const handleRetry = () => {
    setError(null);
    setIsInitialized(false);
    setCallStatus('connecting');
    if (!isNewCall && actualCallId) {
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