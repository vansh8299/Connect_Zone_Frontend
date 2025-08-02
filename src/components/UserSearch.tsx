import { SEARCH_USERS } from '@/graphql/query/callquery';
import { gql, useLazyQuery } from '@apollo/client';
import { useState } from 'react';


export default function UserSearch({ onSelectUser }: { onSelectUser: (user: any) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchUsers, { data, loading, error }] = useLazyQuery(SEARCH_USERS);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchUsers({ variables: { searchTerm } });
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search users..."
          className="flex-1 p-2 border rounded"
        />
        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {data?.searchUsers && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg">
          {data.searchUsers.map((user: any) => (
            <div 
              key={user.id}
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-3"
              onClick={() => {
                onSelectUser(user);
                setSearchTerm('');
              }}
            >
              <img 
                src={user.avatar || '/default-avatar.png'} 
                alt={`${user.firstName} ${user.lastName}`}
                className="w-8 h-8 rounded-full"
              />
              <span>{user.firstName} {user.lastName}</span>
            </div>
          ))}
        </div>
      )}
      
      {error && <div className="text-red-500 mt-1">{error.message}</div>}
    </div>
  );
}