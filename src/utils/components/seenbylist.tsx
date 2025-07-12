interface SeenByListProps {
  message: {
    readBy?: { user: { id: string } }[];
  };
  currentUserId: string;
  participants: { id: string; firstName: string; avatar?: string; user: { id: string } }[];
}

export const SeenByList: React.FC<SeenByListProps> = ({ message, currentUserId, participants }) => {
  const readByUsers = message.readBy
    ?.map(read => participants.find(p => p.user.id === read.user.id))
    .filter(Boolean);

  if (!readByUsers?.length) return null;
  console.log('SeenByList', readByUsers);

  return (
    <div className="absolute right-0 bottom-0 transform translate-y-full bg-white shadow-lg rounded-lg p-2 z-10 min-w-[150px]">
      <div className="text-xs font-semibold text-gray-500 mb-1">Seen by:</div>
      {readByUsers.map(user => (
        <div key={user!.id} className="flex items-center py-1">
         
          <span className="text-sm">
            {user!.firstName} {user!.id === currentUserId && '(You)'}
          </span>
        </div>
      ))}
    </div>
  );
};