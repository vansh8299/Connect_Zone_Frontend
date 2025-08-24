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
  // Use useRef to persist WebRTC service instance across re-renders
  const webRTCRef = useRef<WebRTCService | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "ringing" | "connected"
  >("idle");
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  // Add flags to prevent multiple simultaneous operations
  const isCallingRef = useRef<boolean>(false);
  const isAnsweringRef = useRef<boolean>(false);
  const cleanupInProgressRef = useRef<boolean>(false);

  // Initialize WebRTC service only once
  const getWebRTCService = useCallback(() => {
    if (!webRTCRef.current) {
      console.log("Creating new WebRTC service instance");
      webRTCRef.current = new WebRTCService();
    }
    return webRTCRef.current;
  }, []);

  // GraphQL mutations
  const [startCall] = useMutation(START_CALL, {
    errorPolicy: "all",
    onError: (error) => {
      console.error("Start call mutation error:", error);
      setError(`Failed to start call: ${error.message}`);
      isCallingRef.current = false;
      setCallStatus("idle");
    },
  });

  const [answerCall] = useMutation(ANSWER_CALL, {
    errorPolicy: "all",
    onError: (error) => {
      console.error("Answer call mutation error:", error);
      setError(`Failed to answer call: ${error.message}`);
      isAnsweringRef.current = false;
      setCallStatus("idle");
    },
  });

  const [addIceCandidate] = useMutation(ADD_ICE_CANDIDATE, {
    errorPolicy: "all",
    onError: (error) => {
      console.error("ICE candidate mutation error:", error);
      // Don't set error state for ICE candidate failures as they're not critical
    },
  });

  // Clean up function
  const performCleanup = useCallback(() => {
    if (cleanupInProgressRef.current) return;

    console.log("Performing cleanup...");
    cleanupInProgressRef.current = true;

    try {
      // Reset flags
      isCallingRef.current = false;
      isAnsweringRef.current = false;

      // Reset state
      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus("idle");
      setCurrentCallId(null);
      setError(null);

      // Cleanup WebRTC service
      const webRTC = webRTCRef.current;
      if (webRTC) {
        webRTC.cleanup();
        // Don't set to null here, let it be recreated when needed
      }
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, []);

  // Initialize WebRTC service with callbacks
  const initializeWebRTC = useCallback(async () => {
    try {
      const webRTC = getWebRTCService();

      // Force cleanup and reinitialize if needed
      if (
        webRTC.getConnectionState() !== "new" &&
        webRTC.getConnectionState() !== null
      ) {
        console.log("Cleaning up existing connection before initializing");
        webRTC.cleanup();
      }

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
            setError(null);
            isCallingRef.current = false;
            isAnsweringRef.current = false;
            break;
          case "failed":
          case "disconnected":
            setError(
              state === "failed" ? "Connection failed" : "Connection lost"
            );
            performCleanup();
            break;
          case "closed":
            performCleanup();
            break;
        }
      });

      webRTC.onIceCandidate(async (candidate) => {
        if (currentCallId && !cleanupInProgressRef.current) {
          try {
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
          }
        }
      });
    } catch (err) {
      console.error("WebRTC initialization error:", err);
      setError("Failed to access camera/microphone");
      performCleanup();
      throw err;
    }
  }, [currentCallId, addIceCandidate, getWebRTCService, performCleanup]);

  // Start a new call
  const makeCall = async (receiverId: string) => {
    try {
      // Prevent multiple simultaneous calls
      if (isCallingRef.current || isAnsweringRef.current) {
        console.warn("Call operation already in progress");
        return;
      }

      // Check if we're already in a call
      if (callStatus !== "idle") {
        console.warn(`Cannot start call while in state: ${callStatus}`);
        setError("Already in a call or call in progress");
        return;
      }

      // Clean up any existing state first
      performCleanup();

      // Small delay to ensure cleanup is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      isCallingRef.current = true;
      setError(null);
      setCallStatus("calling");

      await initializeWebRTC();
      const webRTC = getWebRTCService();

      // Add extra validation
      const connectionState = webRTC.getConnectionState();
      console.log("Connection state before creating offer:", connectionState);

      const offer = await webRTC.createOffer();

      if (!offer || !offer.sdp) {
        throw new Error("Failed to create offer");
      }

      console.log("Offer created successfully");

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
      performCleanup();

      // Handle specific error types
      if (err.message?.includes("signaling state")) {
        setError("Connection error. Please wait a moment and try again.");
      } else if (
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
      // Prevent multiple simultaneous operations
      if (isCallingRef.current || isAnsweringRef.current) {
        console.warn("Cannot handle incoming call - operation in progress");
        return;
      }

      // Check if we're already in a call
      if (callStatus !== "idle") {
        console.warn(
          `Cannot handle incoming call while in state: ${callStatus}`
        );
        setError("Already in a call");
        return;
      }

      isAnsweringRef.current = true;
      setError(null);
      console.log("Handling incoming call:", callId);

      // Clean up any existing state first
      performCleanup();

      // Small delay to ensure cleanup is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      await initializeWebRTC();
      const webRTC = getWebRTCService();

      setCurrentCallId(callId);
      setCallStatus("ringing");

      const answer = await webRTC.handleIncomingCall(sdpOffer);

      if (!answer || !answer.sdp) {
        throw new Error("Failed to create answer");
      }

      console.log("Answer created successfully");

      await answerCall({
        variables: {
          input: {
            callId,
            sdpAnswer: JSON.stringify(answer),
          },
        },
      });

      console.log("Call answered successfully");
      isAnsweringRef.current = false;
    } catch (err: any) {
      console.error("Error answering call:", err);
      performCleanup();

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
      const webRTC = getWebRTCService();
      if (!webRTC) return false;
      const isSharing = await webRTC.toggleScreenShare();
      return isSharing;
    } catch (error) {
      console.error("Error toggling screen share:", error);
      setError("Failed to toggle screen share");
      return false;
    }
  };

  // Subscribe to incoming calls - Add error handling and retry logic
  useSubscription(CALL_INITIATED_SUBSCRIPTION, {
    errorPolicy: "all",
    onData: ({ data }) => {
      console.log("Call initiated subscription data:", data);
      const callData = data.data?.callInitiated;
      if (callData && callData.call.receiver.id === userId) {
        console.log("Incoming call detected for user:", userId);
        handleIncomingCall(callData.call.id, callData.sdpOffer);
      }
    },
    onError: (error) => {
      console.error("Call initiated subscription error:", error);
      setError("Connection error with server. Please refresh the page.");
    },
  });

  // Subscribe to call answers
  useSubscription(CALL_ANSWERED_SUBSCRIPTION, {
    variables: { callId: currentCallId },
    skip: !currentCallId,
    errorPolicy: "all",
    onData: ({ data }) => {
      console.log("Call answered subscription data:", data);
      const answerData = data.data?.callAnswered;
      if (answerData?.sdpAnswer && !cleanupInProgressRef.current) {
        const webRTC = getWebRTCService();
        webRTC
          .handleCallAnswered(answerData.sdpAnswer)
          .then(() => {
            setCallStatus("connected");
            isCallingRef.current = false;
            console.log("Remote description set successfully");
          })
          .catch((err) => {
            console.error("Error setting remote description:", err);
            setError("Failed to establish connection");
            performCleanup();
          });
      }
    },
    onError: (error) => {
      console.error("Call answered subscription error:", error);
      setError("Failed to receive call response");
    },
  });

  // Subscribe to ICE candidates
  useSubscription(ICE_CANDIDATE_SUBSCRIPTION, {
    variables: { callId: currentCallId },
    skip: !currentCallId,
    errorPolicy: "all",
    onData: ({ data }) => {
      const candidateData = data.data?.iceCandidateReceived;
      if (candidateData && !cleanupInProgressRef.current) {
        try {
          const webRTC = getWebRTCService();
          webRTC.addIceCandidate(JSON.parse(candidateData.candidate));
        } catch (err) {
          console.error("Error adding received ICE candidate:", err);
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
      performCleanup();
      // TODO: Add mutation to notify server about call end
    } catch (err) {
      console.error("Error ending call:", err);
    }
  };

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      console.log("useCall cleanup effect running");
      performCleanup();
      if (webRTCRef.current) {
        webRTCRef.current = null;
      }
    };
  }, [performCleanup]);

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
