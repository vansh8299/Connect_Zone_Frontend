import React from "react";
import { FaExclamationTriangle } from "react-icons/fa";

interface CallErrorProps {
  error: string;
  onRetry?: () => void;
}

const CallError: React.FC<CallErrorProps> = ({ error, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-red-500/10 p-6 rounded-lg max-w-md text-center">
        <FaExclamationTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Call Error</h3>
        <p className="text-gray-300 mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

export default CallError;
