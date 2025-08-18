'use client';

import { useQuery, useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import CallItem from '@/components/CallItem';
import UserSearch from '@/components/UserSearch';
import { CALL_INITIATED_SUBSCRIPTION, GET_CALL_HISTORY } from '@/graphql/query/callquery';

export default function CallHistory() {
  const { user } = useUser();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { loading, error, data, refetch } = useQuery(GET_CALL_HISTORY, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });
  
  useSubscription(CALL_INITIATED_SUBSCRIPTION, {
    onData: ({ data: subscriptionData }) => {
      console.log('Received callInitiated subscription data:', subscriptionData);
      
      try {
        if (subscriptionData.data?.callInitiated?.call) {
          const call = subscriptionData.data.callInitiated.call;
          
          // Validate call data
          if (!call.id || !call.receiver || !call.caller) {
            console.error('Invalid call data received:', call);
            return;
          }
          
          // Double check - only show if current user is the receiver
          if (call.receiver?.id === user?.id && call.caller?.id !== user?.id) {
            console.log('Showing incoming call popup');
            
            // Show confirmation dialog with proper error handling
            const shouldAnswer = window.confirm(
              `Incoming call from ${call.caller.firstName || 'Unknown'} ${call.caller.lastName || 'User'}. Answer?`
            );
            
            if (shouldAnswer) {
              // Navigate to the call page with the call ID
              router.push(`/pages/calls/${call.id}`);
            }
          }
        }
      } catch (error) {
        console.error('Error handling callInitiated subscription:', error);
      }
      
      // Refetch call history to update the list
      refetch().catch(err => console.error('Error refetching call history:', err));
    },
    onError: (error) => {
      console.error('CallInitiated subscription error:', error);
    }
  });

  if (loading && !data) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Loading call history...</div>
        </div>
      </div>
    );
  }
  
  if (error && !data) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-xl text-red-600 mb-4">
            Error loading call history: {error.message}
          </div>
          <button 
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Add comprehensive data validation and filtering
  const callHistory = data?.getCallHistory || [];
  
  // Filter out calls with invalid data and add validation
  const validCalls = callHistory.filter((call: any) => {
    if (!call || !call.id) {
      console.warn('Call without ID found:', call);
      return false;
    }
    
    // Check if required fields exist
    if (!call.caller && !call.receiver) {
      console.warn('Call without caller or receiver:', call);
      return false;
    }
    
    // Check for valid user objects
    if (call.caller && (!call.caller.id || !call.caller.firstName)) {
      console.warn('Call with invalid caller data:', call);
      return false;
    }
    
    if (call.receiver && (!call.receiver.id || !call.receiver.firstName)) {
      console.warn('Call with invalid receiver data:', call);
      return false;
    }
    
    return true;
  });

  // Filter by search query if provided
  const filteredCalls = validCalls.filter((call: any) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const caller = call.caller;
    const receiver = call.receiver;
    
    // Search in caller and receiver names
    const callerName = caller ? `${caller.firstName || ''} ${caller.lastName || ''}`.toLowerCase() : '';
    const receiverName = receiver ? `${receiver.firstName || ''} ${receiver.lastName || ''}`.toLowerCase() : '';
    
    return callerName.includes(query) || receiverName.includes(query);
  });

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Call History</h1>
        
        {/* Search Section */}
        <div className="mb-6">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search call history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <UserSearch
       onSelectUser={(selectedUser)=> {
              try {
                if (!selectedUser || !selectedUser.id) {
                  console.error('Invalid user selected:', selectedUser);
                  return;
                }
                
                // Validate user data
                if (!selectedUser.firstName) {
                  console.error('User missing required fields:', selectedUser);
                  return;
                }
                
                // Start a call with the selected user
                router.push(`/pages/calls/new?receiverId=${selectedUser.id}`);
              } catch (error) {
                console.error('Error starting call with selected user:', error);
              }
            }}
          />
        </div>
        
        {/* Call History List */}
        <div className="space-y-4">
          {filteredCalls.length > 0 ? (
            filteredCalls.map((call: any) => {
              try {
                // Determine the other user (the one we're calling or who called us)
                const otherUser = call.caller?.id === user?.id ? call.receiver : call.caller;
                
                if (!otherUser) {
                  console.warn('Cannot determine other user for call:', call.id);
                  return null;
                }
                
                return (
                  <CallItem
                    key={call.id}
                    call={call}
                    currentUserId={user?.id}
                    onClick={() => {
                      try {
                        // Start a new call with the other user
                        router.push(`/pages/calls/new?receiverId=${otherUser.id}`);
                      } catch (error) {
                        console.error('Error navigating to call:', error);
                      }
                    }}
                  />
                );
              } catch (error) {
                console.error('Error rendering call item:', call.id, error);
                return null;
              }
            })
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">
                {searchQuery.trim() ? 'No calls found matching your search' : 'No call history found'}
              </div>
              {searchQuery.trim() && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-blue-500 hover:text-blue-700"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Error display for partial data */}
        {error && data && (
          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            <p>Warning: Some call data could not be loaded. {error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}