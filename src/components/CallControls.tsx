export default function CallControls({ 
  status, 
  isCaller, 
  onAnswer, 
  onEnd 
}: {
  status: string;
  isCaller: boolean;
  onAnswer: () => void;
  onEnd: () => void;
}) {
  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return isCaller ? 'Calling...' : 'Incoming call...';
      case 'connected':
        return 'Call in progress';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg">{getStatusText()}</p>
      
      <div className="flex gap-4">
        {!isCaller && status === 'connecting' && (
          <button 
            onClick={onAnswer}
            className="bg-green-500 text-white p-3 rounded-full hover:bg-green-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        )}
        
        <button 
          onClick={onEnd}
          className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}