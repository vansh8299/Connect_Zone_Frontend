import { useQuery, useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/context/UserContext';
import CallItem from '@/components/CallItem';
import UserSearch from '@/components/UserSearch';
import { CALL_INITIATED_SUBSCRIPTION, GET_CALL_HISTORY } from '@/graphql/query/callquery';



export default function CallHistory() {
  const { user } = useUser();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { loading, error, data, refetch } = useQuery(GET_CALL_HISTORY);
  
  useSubscription(CALL_INITIATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.callInitiated?.call?.receiver?.id === user?.id) {
        // Show incoming call notification
        const call = data.data.callInitiated.call;
        if (confirm(`Incoming call from ${call.caller.firstName} ${call.caller.lastName}. Answer?`)) {
          router.push(`/call/${call.id}`);
        }
      }
      refetch();
    }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Call History</h1>
      
      <div className="mb-6">
        <UserSearch 
          onSelectUser={(selectedUser) => {
            // Start a call with the selected user
            router.push(`/call/new?receiverId=${selectedUser.id}`);
          }}
        />
      </div>
      
      <div className="space-y-4">
        {data?.getCallHistory?.map((call: any) => (
          <CallItem 
            key={call.id} 
            call={call} 
            currentUserId={user?.id}
            onClick={() => router.push(`/call/${call.id}`)}
          />
        ))}
      </div>
    </div>
  );
}