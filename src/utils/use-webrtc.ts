import { useEffect, useState, useRef } from "react";
import { ICE_CONFIGURATION, MEDIA_CONSTRAINTS } from "./webrtc-config";

interface UseWebRTCProps {
  callId: string | null;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange: (state: RTCIceConnectionState) => void;
}

export const useWebRTC = ({
  callId,
  onIceCandidate,
  onConnectionStateChange,
}: UseWebRTCProps) => {
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] =
    useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize media devices and peer connection
  const initialize = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        MEDIA_CONSTRAINTS
      );

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_CONFIGURATION);

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle incoming remote stream
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      // ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onIceCandidate(event.candidate);
        }
      };

      // Connection state changes
      pc.oniceconnectionstatechange = () => {
        onConnectionStateChange(pc.iceConnectionState);
      };

      setPeerConnection(pc);
      return pc;
    } catch (err: any) {
      let errorMessage = "Could not access media devices";
      if (err.name === "NotAllowedError") {
        errorMessage = "Please allow access to camera and microphone";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera or microphone found";
      }
      setError(errorMessage);
      throw err;
    }
  };

  // Media control functions
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  };

  const toggleScreenShare = async () => {
    try {
      if (screenShareStream) {
        // Stop screen sharing
        screenShareStream.getTracks().forEach((track) => track.stop());
        setScreenShareStream(null);

        // Restore camera video
        if (localStream && peerConnection) {
          const videoTrack = localStream.getVideoTracks()[0];
          const sender = peerConnection
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        }
        return false;
      } else {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setScreenShareStream(stream);

        if (peerConnection) {
          const screenTrack = stream.getVideoTracks()[0];
          const sender = peerConnection
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(screenTrack);
          }
        }

        // Handle when user stops sharing through browser UI
        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
        return true;
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      setError("Could not start screen sharing");
      return false;
    }
  };

  // Clean up resources
  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (screenShareStream) {
      screenShareStream.getTracks().forEach((track) => track.stop());
      setScreenShareStream(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setRemoteStream(null);
    setError(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    peerConnection,
    localStream,
    remoteStream,
    screenShareStream,
    error,
    localVideoRef,
    remoteVideoRef,
    initialize,
    cleanup,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
};
