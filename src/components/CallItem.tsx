import { formatDistanceToNow } from 'date-fns';

export default function CallItem({ call, currentUserId, onClick }: { 
  call: any, 
  currentUserId?: string, 
  onClick: () => void 
}) {
  const isOutgoing = call.caller.id === currentUserId;
  const otherUser = isOutgoing ? call.receiver : call.caller;
  
  const getStatusText = () => {
    switch (call.status) {
      case 'COMPLETED':
        return `Call lasted ${call.duration} seconds`;
      case 'MISSED':
        return isOutgoing ? 'Missed call' : 'You missed this call';
      case 'REJECTED':
        return 'Call rejected';
      case 'ONGOING':
        return 'Call in progress';
      default:
        return '';
    }
  };
  
  const getStatusColor = () => {
    switch (call.status) {
      case 'COMPLETED':
        return 'text-green-500';
      case 'MISSED':
      case 'REJECTED':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div 
      className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <img 
          src={otherUser.avatar || '/default-avatar.png'} 
          alt={`${otherUser.firstName} ${otherUser.lastName}`}
          className="w-12 h-12 rounded-full"
        />
        <div>
          <h3 className="font-medium">
            {otherUser.firstName} {otherUser.lastName}
          </h3>
          <p className={`text-sm ${getStatusColor()}`}>
            {isOutgoing ? 'Outgoing call' : 'Incoming call'} • {getStatusText()}
          </p>
        </div>
      </div>
      <div className="text-sm text-gray-500">
        {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
      </div>
    </div>
  );
}