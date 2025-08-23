"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useCall } from "@/utils/useCall";
import VideoCallControls from "@/components/VideoCallControls";

export default function CallPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useUser();

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Media control states
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Get call ID or receiver ID
  const getCallIdOrReceiverId = () => {
    if (params.id === "new") {
      return searchParams.get("receiverId");
    }
    return params.id as string;
  };

  const callIdOrReceiverId = getCallIdOrReceiverId();

  // Initialize WebRTC handling
  const {
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
  } = useCall(user?.id || "");

  // Effect to attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  // Effect to handle initial call setup
  useEffect(() => {
    if (!callIdOrReceiverId || !user?.id) return;

    if (params.id === "new") {
      makeCall(callIdOrReceiverId);
    }
  }, [callIdOrReceiverId, user?.id, params.id, makeCall]);

  // Media control handlers
  const handleToggleAudio = async () => {
    const enabled = await toggleAudio();
    setIsAudioEnabled(enabled);
  };

  const handleToggleVideo = async () => {
    const enabled = await toggleVideo();
    setIsVideoEnabled(enabled);
  };

  const handleToggleScreenShare = async () => {
    const isSharing = await toggleScreenShare();
    setIsScreenSharing(isSharing);
  };

  const handleEndCall = async () => {
    await endCall();
    router.push("/calls");
  };

  const handleAnswer = async () => {
    if (callIdOrReceiverId) {
      await handleIncomingCall(callIdOrReceiverId, ""); // The SDP offer will be handled internally
    }
  };

  // Error handling
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center p-4">
          <h3 className="text-xl font-semibold mb-2">Call Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-gray-900">
      {/* Call Status Indicator */}
      <div
        className="absolute top-4 left-1/2 transform -translate-x-1/2 
          bg-black bg-opacity-50 text-white px-4 py-2 rounded-full z-10"
      >
        {callStatus === "ringing" && (
          <div className="flex items-center space-x-2">
            <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full" />
            <span>Ringing...</span>
          </div>
        )}
        {callStatus === "calling" && (
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-white rounded-full border-t-transparent" />
            <span>Connecting...</span>
          </div>
        )}
        {callStatus === "connected" && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Connected</span>
          </div>
        )}
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full p-4">
        {/* Local Video */}
        <div className="relative w-full h-full">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover rounded-lg ${
              !isVideoEnabled ? "hidden" : ""
            }`}
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
              <div className="text-white text-xl font-semibold">Camera Off</div>
            </div>
          )}
          <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
            You {isAudioEnabled ? "🎤" : "🚫"}
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative w-full h-full">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
            {callStatus === "connected" ? "Remote User" : "Waiting..."}
          </div>
        </div>
      </div>

      {/* Call Controls */}
      <VideoCallControls
        status={callStatus}
        isCaller={params.id === "new"}
        onAnswer={handleAnswer}
        onEnd={handleEndCall}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
      />
    </div>
  );
}
