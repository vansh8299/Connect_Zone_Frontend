import { useEffect, useState, useCallback, useRef } from "react";
import { useMutation, useSubscription } from "@apollo/client";
import WebRTCService from "./WebRTCService";
import {
  START_CALL,
  ANSWER_CALL,
  ADD_ICE_CANDIDATE,
  CALL_INITIATED_SUBSCRIPTION,
  CALL_ANSWERED_SUBSCRIPTION,
  ICE_CANDIDATE_SUBSCRIPTION,
} from "../graphql/query/call-queries";

export const useCall = (userId: string) => {
  const [webRTC] = useState(() => new WebRTCService());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "ringing" | "connected"
  >("idle");
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  // GraphQL mutations
  const [startCall] = useMutation(START_CALL, {
    errorPolicy: "all",
    onError: (error) => {
      console.error("Start call mutation error:", error);
      setError(`Failed to start call: ${error.message}`);
    },
  });

  const [answerCall] = useMutation(ANSWER_CALL, {
    errorPolicy: "all",
    onError: (error) => {
      console.error("Answer call mutation error:", error);
      setError(`Failed to answer call: ${error.message}`);
    },
  });

  const [addIceCandidate] = useMutation(ADD_ICE_CANDIDATE, {
    errorPolicy: "all",
    onError: (error) => {
      console.error("ICE candidate mutation error:", error);
      // Don't set error state for ICE candidate failures as they're not critical
    },
  });

  // Initialize WebRTC service
  const initializeWebRTC = useCallback(async () => {
    try {
      const stream = await webRTC.initializeLocalStream();
      setLocalStream(stream);

      webRTC.onRemoteStream((stream) => {
        console.log("Remote stream received:", stream);
        setRemoteStream(stream);
      });

      webRTC.onConnectionStateChange((state) => {
        console.log("Connection state changed:", state);
        switch (state) {
          case "connected":
            setCallStatus("connected");
            setError(null); // Clear any previous errors
            break;
          case "failed":
            setError("Connection failed");
            setCallStatus("idle");
            break;
          case "disconnected":
            setError("Connection lost");
            setCallStatus("idle");
            break;
          case "closed":
            setCallStatus("idle");
            break;
        }
      });

      webRTC.onIceCandidate(async (candidate) => {
        if (currentCallId) {
          try {
            // Create minimal ICE candidate object
            const minimalCandidate = {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
            };

            await addIceCandidate({
              variables: {
                input: {
                  callId: currentCallId,
                  candidate: JSON.stringify(minimalCandidate),
                },
              },
            });
          } catch (err) {
            console.error("Error sending ICE candidate:", err);
            // Don't break the call for ICE candidate failures
          }
        }
      });
    } catch (err) {
      console.error("WebRTC initialization error:", err);
      setError("Failed to access camera/microphone");
      throw err;
    }
  }, [currentCallId, addIceCandidate]);

  // Start a new call
  const makeCall = async (receiverId: string) => {
    try {
      setError(null);
      setCallStatus("calling");

      await initializeWebRTC();
      const offer = await webRTC.createOffer();

      if (!offer || !offer.sdp) {
        throw new Error("Failed to create offer");
      }

      console.log("Offer created, SDP length:", offer.sdp.length);

      // Create minimal offer object
      const minimalOffer = {
        type: offer.type,
        sdp: offer.sdp,
      };

      const result = await startCall({
        variables: {
          input: {
            receiverId,
            sdpOffer: JSON.stringify(minimalOffer),
          },
        },
      });

      const call = result.data?.startCall?.call;
      if (call) {
        setCurrentCallId(call.id);
        console.log("Call started with ID:", call.id);
      } else {
        throw new Error("No call data returned from server");
      }
    } catch (err: any) {
      console.error("Error starting call:", err);
      setCallStatus("idle");

      // Handle specific error types
      if (
        err.message?.includes("413") ||
        err.message?.includes("Payload Too Large")
      ) {
        setError("Call data too large. Please try again.");
      } else if (err.networkError) {
        setError("Network error. Please check your connection.");
      } else {
        setError(`Failed to start call: ${err.message}`);
      }
    }
  };

  // Handle incoming call
  const handleIncomingCall = async (callId: string, sdpOffer: string) => {
    try {
      setError(null);
      console.log("Handling incoming call:", callId);

      await initializeWebRTC();
      setCurrentCallId(callId);
      setCallStatus("ringing");

      const answer = await webRTC.handleIncomingCall(sdpOffer);

      if (!answer || !answer.sdp) {
        throw new Error("Failed to create answer");
      }

      console.log("Answer created, SDP length:", answer.sdp.length);

      await answerCall({
        variables: {
          input: {
            callId,
            sdpAnswer: JSON.stringify(answer),
          },
        },
      });

      console.log("Call answered successfully");
    } catch (err: any) {
      console.error("Error answering call:", err);
      setCallStatus("idle");
      setCurrentCallId(null);

      if (
        err.message?.includes("413") ||
        err.message?.includes("Payload Too Large")
      ) {
        setError("Answer data too large. Please try again.");
      } else {
        setError(`Failed to answer call: ${err.message}`);
      }
    }
  };

  // Media control functions
  const toggleAudio = async () => {
    if (!localStream) return false;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  };

  const toggleVideo = async () => {
    if (!localStream) return false;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  };

  const toggleScreenShare = async () => {
    try {
      if (!webRTC) return false;
      const isSharing = await webRTC.toggleScreenShare();
      return isSharing;
    } catch (error) {
      console.error("Error toggling screen share:", error);
      setError("Failed to toggle screen share");
      return false;
    }
  };

  // Subscribe to incoming calls
  useSubscription(CALL_INITIATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      console.log("Call initiated subscription data:", data);
      const callData = data.data?.callInitiated;
      if (callData && callData.call.receiver.id === userId) {
        handleIncomingCall(callData.call.id, callData.sdpOffer);
      }
    },
    onError: (error) => {
      console.error("Call initiated subscription error:", error);
    },
  });

  // Subscribe to call answers
  useSubscription(CALL_ANSWERED_SUBSCRIPTION, {
    variables: { callId: currentCallId },
    skip: !currentCallId,
    onData: ({ data }) => {
      console.log("Call answered subscription data:", data);
      const answerData = data.data?.callAnswered;
      if (answerData?.sdpAnswer) {
        webRTC
          .handleCallAnswered(answerData.sdpAnswer)
          .then(() => {
            setCallStatus("connected");
            console.log("Remote description set successfully");
          })
          .catch((err) => {
            console.error("Error setting remote description:", err);
            setError("Failed to establish connection");
          });
      }
    },
    onError: (error) => {
      console.error("Call answered subscription error:", error);
    },
  });

  // Subscribe to ICE candidates
  useSubscription(ICE_CANDIDATE_SUBSCRIPTION, {
    variables: { callId: currentCallId },
    skip: !currentCallId,
    onData: ({ data }) => {
      const candidateData = data.data?.iceCandidateReceived;
      if (candidateData) {
        try {
          webRTC.addIceCandidate(JSON.parse(candidateData.candidate));
        } catch (err) {
          console.error("Error adding received ICE candidate:", err);
          // Don't break the call for ICE candidate failures
        }
      }
    },
    onError: (error) => {
      console.error("ICE candidate subscription error:", error);
    },
  });

  const endCall = async () => {
    try {
      console.log("Ending call:", currentCallId);

      // Reset all state
      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus("idle");
      setCurrentCallId(null);
      setError(null);

      // TODO: Add mutation to notify server about call end
      // await endCallMutation({ variables: { callId: currentCallId } });
    } catch (err) {
      console.error("Error ending call:", err);
    }
  };

  return {
    localStream,
    remoteStream,
    callStatus,
    error,
    makeCall,
    handleIncomingCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    currentCallId,
  };
};
