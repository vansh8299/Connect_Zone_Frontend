import React from "react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhone,
  FaPhoneSlash,
  FaDesktop,
} from "react-icons/fa";

interface VideoCallControlsProps {
  status: "idle" | "ringing" | "calling" | "connected";
  isCaller: boolean;
  onAnswer: () => void;
  onEnd: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

const VideoCallControls: React.FC<VideoCallControlsProps> = ({
  status,
  isCaller,
  onAnswer,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90 p-4">
      <div className="flex justify-center items-center space-x-6">
        {/* Audio Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-4 rounded-full ${
            isAudioEnabled
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {isAudioEnabled ? (
            <FaMicrophone className="w-6 h-6 text-white" />
          ) : (
            <FaMicrophoneSlash className="w-6 h-6 text-white" />
          )}
        </button>

        {/* Video Toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-4 rounded-full ${
            isVideoEnabled
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {isVideoEnabled ? (
            <FaVideo className="w-6 h-6 text-white" />
          ) : (
            <FaVideoSlash className="w-6 h-6 text-white" />
          )}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`p-4 rounded-full ${
            isScreenSharing
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-gray-500 hover:bg-gray-600"
          }`}
        >
          {isScreenSharing ? (
            <FaDesktop className="w-6 h-6 text-white" />
          ) : (
            <FaDesktop className="w-6 h-6 text-white" />
          )}
        </button>

        {/* Answer/End Call */}
        {status === "ringing" && !isCaller ? (
          <button
            onClick={onAnswer}
            className="p-4 rounded-full bg-green-500 hover:bg-green-600"
          >
            <FaPhone className="w-6 h-6 text-white" />
          </button>
        ) : (
          <button
            onClick={onEnd}
            className="p-4 rounded-full bg-red-500 hover:bg-red-600"
          >
            <FaPhoneSlash className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoCallControls;
