import React from "react";

interface CallStatusProps {
  status: string;
  userName?: string;
}

const CallStatus: React.FC<CallStatusProps> = ({ status, userName }) => {
  return (
    <div
      className="absolute top-4 left-1/2 transform -translate-x-1/2 
      bg-black bg-opacity-50 text-white px-4 py-2 rounded-full 
      transition-all duration-300 ease-in-out z-10"
    >
      {status === "ringing" && (
        <div className="flex items-center space-x-2">
          <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full" />
          <span>Calling {userName}...</span>
        </div>
      )}
      {status === "connecting" && (
        <div className="flex items-center space-x-2">
          <div className="animate-spin w-4 h-4 border-2 border-white rounded-full border-t-transparent" />
          <span>Connecting...</span>
        </div>
      )}
      {status === "connected" && (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Connected</span>
        </div>
      )}
      {status === "reconnecting" && (
        <div className="flex items-center space-x-2">
          <div className="animate-spin w-4 h-4 border-2 border-yellow-500 rounded-full border-t-transparent" />
          <span>Reconnecting...</span>
        </div>
      )}
      {status === "initiating" && (
        <div className="flex items-center space-x-2">
          <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full" />
          <span>Starting call...</span>
        </div>
      )}
    </div>
  );
};

export default CallStatus;
