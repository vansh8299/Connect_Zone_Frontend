import React from 'react';

// Safe date formatting function
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown time';
  
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return 'Invalid date';
    }
    
    // Format the date
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error, 'Date string:', dateString);
    return 'Invalid date';
  }
};

// Safe duration calculation
const calculateDuration = (startTime: string | null, endTime: string | null): string => {
  if (!startTime || !endTime) return 'Unknown duration';
  
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Unknown duration';
    }
    
    const durationMs = end.getTime() - start.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 'Unknown duration';
  }
};

interface CallItemProps {
  call: {
    id: string;
    status: string;
    caller?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    receiver?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    createdAt?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
  };
  currentUserId?: string;
  onClick: () => void;
}

export default function CallItem({ call, currentUserId, onClick }: CallItemProps) {
  // Safely determine if current user is the caller
  const isCaller = call.caller?.id === currentUserId;
  const otherUser = isCaller ? call.receiver : call.caller;
  
  // Safe fallbacks for user info
  const otherUserName = otherUser 
    ? `${otherUser.firstName || 'Unknown'} ${otherUser.lastName || 'User'}`
    : 'Unknown User';
  
  // Determine call type icon and text
  const getCallTypeInfo = () => {
    if (call.status === 'MISSED') {
      return {
        icon: '📞',
        text: isCaller ? 'Missed call to' : 'Missed call from',
        textColor: 'text-red-600'
      };
    } else if (call.status === 'COMPLETED') {
      return {
        icon: '✅',
        text: isCaller ? 'Called' : 'Call from',
        textColor: 'text-green-600'
      };
    } else {
      return {
        icon: '📞',
        text: isCaller ? 'Call to' : 'Call from',
        textColor: 'text-gray-600'
      };
    }
  };

  const callTypeInfo = getCallTypeInfo();

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">
            {callTypeInfo.icon}
          </div>
          <div>
            <div className={`font-semibold ${callTypeInfo.textColor}`}>
              {callTypeInfo.text} {otherUserName}
            </div>
            <div className="text-sm text-gray-500">
              {formatDate(call.createdAt)}
            </div>
            {call.status === 'COMPLETED' && call.startedAt && call.endedAt && (
              <div className="text-xs text-gray-400">
                Duration: {calculateDuration(call.startedAt, call.endedAt)}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium capitalize ${
            call.status === 'COMPLETED' ? 'text-green-600' : 
            call.status === 'MISSED' ? 'text-red-600' : 
            'text-yellow-600'
          }`}>
            {call.status?.toLowerCase() || 'Unknown'}
          </div>
          <div className="text-xs text-gray-400">
            Call ID: {call.id.slice(-8)}
          </div>
        </div>
      </div>
    </div>
  );
}