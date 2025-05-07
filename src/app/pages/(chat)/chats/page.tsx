// src/app/chat/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery, useApolloClient } from '@apollo/client';
import { getCookie } from 'cookies-next';
import { 
  GET_CONVERSATIONS, 
  GET_MESSAGES, 
  SEND_MESSAGE, 
  CREATE_CONVERSATION, 
  GET_USER_BY_EMAIL, 
  SEARCH_USERS,
 
} from '@/graphql/query/chatquery';
import { GET_USER_BY_ID } from '@/graphql/query/query';
import { FaPaperclip, FaSmile, FaPaperPlane, FaPhone, FaVideo, FaInfoCircle, FaEllipsisV, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { useSocket } from '@/utils/SocketContext';

export default function ChatPage() {
  // State
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [otherParticipantDetails, setOtherParticipantDetails] = useState<any>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]); // Track new messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationId = useRef<string | null>(null);
  
  // Hooks
  const client = useApolloClient();
  const { socket, isConnected } = useSocket();
  
  // Get token and extract user ID
  const token = getCookie('token');
  const currentUserId = token ? extractUserIdFromToken(String(token)) : 'guest-user';

  // Fetch conversations query
  const { data: conversationsData, loading: conversationsLoading } = useQuery(GET_CONVERSATIONS, {
    onCompleted: (data: { getConversations: any[] }) => {
      if (data?.getConversations?.length > 0 && !activeConversationId) {
        setActiveConversationId(data.getConversations[0].id);
        
        // Get other participant details for the first conversation
        const firstConversation = data.getConversations[0];
        const otherParticipant = firstConversation.participants.find(
          (p: any) => p.user.id !== currentUserId
        );
        
        if (otherParticipant) {
          fetchUserDetails(otherParticipant.user.id);
        }
      }
    }
  });

  // Format timestamp helper
  const formatTimestamp = (timestamp: string | number | Date) => {
    if (!timestamp) return '';
    
    let date;
    
    // Check if timestamp is a number (Unix timestamp in milliseconds)
    if (!isNaN(Number(timestamp))) {
      date = new Date(Number(timestamp));
    } 
    // Check if timestamp is already a Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // Otherwise assume it's an ISO string
    else {
      try {
        date = new Date(timestamp);
      } catch (error) {
        console.error('Invalid timestamp format:', timestamp);
        return '';
      }
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date created from timestamp:', timestamp);
      return '';
    }
    
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get user by ID query
  const [getUserById, { loading: userDetailsLoading }] = useLazyQuery(GET_USER_BY_ID, {
    onCompleted: (data) => {
      if (data?.user) {
        setOtherParticipantDetails(data.user);
      }
    },
    onError: (error) => {
      console.error('Error fetching user details:', error);
    }
  });

  // Fetch messages for active conversation
  const { data: messagesData, loading: messagesLoading, refetch: refetchMessages } = useQuery(GET_MESSAGES, {
    variables: { conversationId: activeConversationId },
    skip: !activeConversationId,
    fetchPolicy: 'network-only'
  });

  // Search users query
  const [searchUsersQuery, { loading: searchLoading }] = useLazyQuery(SEARCH_USERS, {
    onCompleted: (data) => {
      setSearchResults(data?.searchUsers || []);
      setIsSearching(false);
    },
    onError: (error) => {
      console.error('Error searching users:', error);
      setIsSearching(false);
    }
  });

  // Get user by email query with auto-start conversation
  const [getUserByEmail] = useLazyQuery(GET_USER_BY_EMAIL, {
    onCompleted: (data: any) => {
      if (data?.userByEmail) {
        // Automatically start a conversation when found a user by email
        startConversation(data.userByEmail.id);
        // Still update search results for consistency
        setSearchResults([data.userByEmail]);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    },
    onError: (error) => {
      console.error('Error fetching user by email:', error);
      setIsSearching(false);
    }
  });

  // Send message mutation
  const [sendMessage] = useMutation(SEND_MESSAGE);
  
  // Create conversation mutation
  const [createConversation] = useMutation(CREATE_CONVERSATION, {
    onCompleted: (data) => {
      // Select the new conversation
      if (data?.createConversation?.id) {
        setActiveConversationId(data.createConversation.id);
        
        // Get the other participant's details from the new conversation
        const newConversation = data.createConversation;
        const otherParticipant = newConversation.participants.find(
          (p: any) => p.user.id !== currentUserId
        );
        
        if (otherParticipant) {
          fetchUserDetails(otherParticipant.user.id);
        }
        
        // Clear search
        setSearchTerm('');
        setIsSearching(false);
        setSearchResults([]);
      }
    },
    onError: (error) => {
      console.error('Error creating conversation:', error);
    }
  });

  // Function to fetch user details
  const fetchUserDetails = (userId: string) => {
    getUserById({
      variables: { id: userId }
    });
  };

  // Effect to update other participant details when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !conversationsData) return;
    
    const activeConversation = conversationsData.getConversations.find(
      (conv: any) => conv.id === activeConversationId
    );
    
    if (activeConversation) {
      const otherParticipant = activeConversation.participants.find(
        (p: any) => p.user.id !== currentUserId
      );
      
      if (otherParticipant) {
        fetchUserDetails(otherParticipant.user.id);
      } else {
        setOtherParticipantDetails(null);
      }
    }
  }, [activeConversationId, conversationsData, currentUserId]);

  // FIX 1: Improved socket message handling with better logging
  useEffect(() => {
    if (!socket) return;
      
    const handleNewMessage = (data: { type: string; payload: any }) => {
      console.log("Socket received message:", data);
          
      if (data.type === 'NEW_MESSAGE') {
        const newMessage = data.payload;
              
        if (!newMessage || !newMessage.conversationId) {
          console.error("Received invalid message format:", newMessage);
          return;
        }
              
        console.log(`Processing new message for conversation: ${newMessage.conversationId}`);
        
        // FIX 2: Check if the message belongs to the active conversation
        // If so, update the UI immediately
        if (newMessage.conversationId === activeConversationId) {
          console.log("Message is for active conversation, updating UI immediately");
          
          // Update Apollo cache directly for the active conversation
          try {
            const existingMessages = client.readQuery({
              query: GET_MESSAGES,
              variables: { conversationId: activeConversationId }
            })?.getMessages || [];
            
            // Check if we already have this message to prevent duplicates
            if (!existingMessages.some((msg: any) => msg.id === newMessage.id)) {
              client.writeQuery({
                query: GET_MESSAGES,
                variables: { conversationId: activeConversationId },
                data: {
                  getMessages: [...existingMessages, newMessage]
                }
              });
              
              // Scroll to bottom on new message
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          } catch (err) {
            console.error("Error updating cache with new message:", err);
          }
        }
              
        // Add new message to our local state for any conversation
        setReceivedMessages(prev => {
          // Check if we already have this message to prevent duplicates
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
              
        // Update conversations list to show the conversation with newest message at top
        client.refetchQueries({
          include: [GET_CONVERSATIONS]
        });
      }
    };
      
    // FIX 3: Make sure we're properly listening to the 'message' event
    socket.off('message'); // Remove any existing listeners to prevent duplicates
    socket.on('message', handleNewMessage);
      
    return () => {
      socket.off('message', handleNewMessage);
    };
  }, [socket, client, activeConversationId]);
  
  // FIX 4: Simplified handling of received messages by using a debounce
  useEffect(() => {
    if (receivedMessages.length === 0) return;
    
    const timer = setTimeout(() => {
      // Process only the messages for non-active conversations
      // (active conversation messages are handled immediately in the socket handler)
      const messagesForOtherConversations = receivedMessages.filter(
        msg => msg.conversationId !== activeConversationId
      );
      
      if (messagesForOtherConversations.length > 0) {
        console.log(`Processing ${messagesForOtherConversations.length} messages for other conversations`);
      }
      
      // Clear all processed messages
      setReceivedMessages([]);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [receivedMessages, activeConversationId]);

  // FIX 5: Improved socket room management
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    if (!activeConversationId) return;
    
    console.log(`Attempting to join conversation room: ${activeConversationId}`);
    
    // Leave previous conversation if any
    if (prevConversationId.current && prevConversationId.current !== activeConversationId) {
      console.log(`Leaving previous conversation room: ${prevConversationId.current}`);
      socket.emit('leaveConversation', prevConversationId.current);
    }
    
    // Join new conversation
    socket.emit('joinConversation', activeConversationId);
    console.log(`Joined conversation room: ${activeConversationId}`);
    
    // Update ref for next change
    prevConversationId.current = activeConversationId;
    
    // Cleanup on unmount
    return () => {
      if (activeConversationId) {
        console.log(`Leaving conversation room on cleanup: ${activeConversationId}`);
        socket.emit('leaveConversation', activeConversationId);
      }
    };
  }, [socket, isConnected, activeConversationId]);

  // Handle reconnection
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      console.log("Socket reconnected, rejoining active conversation");
      if (activeConversationId) {
        socket.emit('joinConversation', activeConversationId);
        // Refetch messages to sync after reconnect
        refetchMessages();
      }
    };

    socket.on('reconnect', handleReconnect);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('reconnect', handleReconnect);
      socket.off('connect', handleReconnect);
    };
  }, [socket, activeConversationId, refetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.getMessages?.length]);

  // Improved message sending with proper error handling
  const handleSendMessage = async () => {
    if (!message.trim() || !activeConversationId) return;
    
    const messageContent = message.trim();
    const optimisticId = `temp-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Clear input immediately for better UX
    setMessage('');
    
    // Create optimistic message
    const optimisticMessage = {
      __typename: 'Message',
      id: optimisticId,
      content: messageContent,
      sender: {
        __typename: 'User',
        id: currentUserId,
        firstName: 'You',
        lastName: '',
        avatar: ''
      },
      readBy: [{
        __typename: 'MessageRead',
        id: `read-${optimisticId}`,
        user: {
          __typename: 'User',
          id: currentUserId,
          firstName: 'You',
          lastName: '',
          avatar: ''
        },
        readAt: timestamp
      }],
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'TEXT',
      conversationId: activeConversationId
    };
    
    // Get current messages from cache
    const currentMessages = client.readQuery({
      query: GET_MESSAGES,
      variables: { conversationId: activeConversationId }
    })?.getMessages || [];
    
    // Update cache with optimistic message
    client.writeQuery({
      query: GET_MESSAGES,
      variables: { conversationId: activeConversationId },
      data: {
        getMessages: [...currentMessages, optimisticMessage]
      }
    });
    
    try {
      // Send via mutation
      const response = await sendMessage({
        variables: {
          input: {
            conversationId: activeConversationId,
            content: messageContent
          }
        }
      });
      
      // FIX 6: Improved socket message sending with detailed logging
      if (socket && isConnected) {
        // Get participant IDs
        const participants = conversationsData?.getConversations
          .find((c: any) => c.id === activeConversationId)?.participants || [];
        
        const receiverIds = participants
          .filter((p: any) => p.user.id !== currentUserId)
          .map((p: any) => p.user.id);
        
        // Send via socket with more complete data
        const messageToSend = {
          ...response.data.sendMessage,
          receivers: receiverIds,
          conversationId: activeConversationId  // Explicitly include conversationId
        };
        
        console.log("Emitting message via socket:", messageToSend);
        socket.emit('message', messageToSend);
      }
      
      // Remove optimistic message and add real message
      const actualMessage = response.data.sendMessage;
      
      // Update cache with the real message
      client.writeQuery({
        query: GET_MESSAGES,
        variables: { conversationId: activeConversationId },
        data: {
          getMessages: [
            ...currentMessages.filter((msg: any) => msg.id !== optimisticId),
            actualMessage
          ]
        }
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error
      client.writeQuery({
        query: GET_MESSAGES,
        variables: { conversationId: activeConversationId },
        data: {
          getMessages: currentMessages.filter((msg: any) => msg.id !== optimisticId)
        }
      });
      
      alert('Failed to send message. Please try again.');
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    // Check if it's an email search
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(term)) {
      // Search by exact email - this will now auto-trigger conversation creation
      getUserByEmail({ variables: { email: term } });
    } else {
      // Search by term
      const searchTimer = setTimeout(() => {
        searchUsersQuery({ variables: { searchTerm: term } });
      }, 300);
      
      return () => clearTimeout(searchTimer);
    }
  };

  // Start a new conversation with a user
  const startConversation = async (userId: string) => {
    try {
      await createConversation({
        variables: {
          participantIds: [userId]
        }
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Helper functions
  const getParticipantName = (conversation: any) => {
    if (!conversation) return 'Unknown';
    
    if (conversation.isGroup) {
      return conversation.participants
        .map((p: any) => p.user.firstName)
        .join(', ');
    }
    
    const otherParticipant = conversation.participants.find(
      (p: any) => p.user.id !== currentUserId
    );
    
    return otherParticipant ? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` : 'Unknown';
  };

  const getParticipantAvatar = (conversation: any) => {
    if (!conversation) return '/globe.svg';
    
    if (conversation.isGroup) return '/globe.svg';
    
    const otherParticipant = conversation.participants.find(
      (p: any) => p.user.id !== currentUserId
    );
    
    return otherParticipant?.user?.avatar || '/globe.svg';
  };

  // Extract user ID from JWT token
  function extractUserIdFromToken(token: string): string | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload.userId || null;
    } catch (error) {
      console.error('Error extracting user ID from token:', error);
      return null;
    }
  }

  // Render participant details
  const renderParticipantDetails = () => {
    if (userDetailsLoading) return (
      <div className="flex justify-center items-center h-full p-6">
        <div className="animate-pulse flex flex-col items-center">
          <div className="rounded-full bg-gray-200 h-20 w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mt-4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6 mt-4"></div>
        </div>
      </div>
    );
    
    if (!otherParticipantDetails) return (
      <div className="flex justify-center items-center h-full p-6">
        <div className="text-center text-gray-500">
          <p>No user details available</p>
        </div>
      </div>
    );
    
    return (
      <div className="participant-details p-6 bg-white h-full overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-gray-800">Profile</h2>
          <button 
            onClick={() => setShowUserDetails(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-4">
            <img 
              src={otherParticipantDetails.avatar || '/globe.svg'} 
              alt={`${otherParticipantDetails.firstName}'s avatar`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/globe.svg';
              }}
            />
          </div>
          <h3 className="text-2xl font-semibold text-gray-800">
            {otherParticipantDetails.firstName} {otherParticipantDetails.lastName}
          </h3>
        </div>
        
        <div className="space-y-6">
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Email</h4>
            <p className="text-gray-800">{otherParticipantDetails.email}</p>
          </div>
          
          {otherParticipantDetails.about && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">About</h4>
              <p className="text-gray-800 whitespace-pre-wrap">{otherParticipantDetails.about}</p>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Account Status</h4>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${otherParticipantDetails.isEmailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <p className="text-gray-800">
                {otherParticipantDetails.isEmailVerified ? 'Verified Account' : 'Email not verified'}
              </p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4 flex justify-center">
            <button className="bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition ease-in-out duration-150">
              Block User
            </button>
          </div>
        </div>
      </div>
    );
  };

  // FIX 7: Debug function to check socket connection
  const checkSocketConnection = () => {
    if (!socket) {
      console.log("Socket not initialized");
      return;
    }
    
    console.log("Socket ID:", socket.id);
    console.log("Socket connected:", isConnected);
    console.log("Socket connected:", socket.connected);
    
    // Ping server to verify connection
    socket.emit("ping");
  };

  // Get the current active conversation data
  const activeConversation = activeConversationId && conversationsData?.getConversations 
    ? conversationsData.getConversations.find((c: any) => c.id === activeConversationId)
    : null;

  // FIX 8: More efficient message merging with proper sorting
  const allMessages = useMemo(() => {
    const serverMessages = messagesData?.getMessages || [];
    
    // Filter new messages for current conversation
    const newMessages = receivedMessages.filter(
      msg => msg.conversationId === activeConversationId
    );
    
    // Combine and deduplicate messages
    const messagesMap = new Map();
    
    // First add server messages to the map
    serverMessages.forEach((msg: { id: any; }) => {
      messagesMap.set(msg.id, msg);
    });
    
    // Then add new messages, overwriting if already exists
    newMessages.forEach(msg => {
      messagesMap.set(msg.id, msg);
    });
    
    // Convert map to array and sort by creation time
    return Array.from(messagesMap.values()).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messagesData?.getMessages, receivedMessages, activeConversationId]);

  // FIX 9: Debug button to check socket connection (for development only)
  // You can add this button somewhere in your UI for debugging
  const renderDebugButton = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <button 
        onClick={checkSocketConnection}
        className="text-xs text-gray-500 hover:text-gray-700 mt-2"
      >
        Check Socket
      </button>
    );
  };
  return (
    <div className="flex h-[calc(100vh-128px)] bg-gray-100">
      {/* Left Sidebar - Conversation List */}
      <div className={`${showUserDetails ? 'hidden md:block md:w-1/4' : 'w-1/4'} bg-white border-r border-gray-200`}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Messages</h1>
          <div className="mt-2 relative">
            <input
              type="text"
              placeholder="Search users or enter email..."
              className="w-full p-2 bg-gray-100 rounded-lg text-sm"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            
            {/* Search Loading Indicator */}
            {isSearching && searchLoading && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500">
                Searching...
              </div>
            )}
            
            {/* Search Results Dropdown */}
            {!isSearching && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
                    onClick={() => startConversation(user.id)}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                      <img
                        src={user.avatar || '/default-avatar.png'}
                        alt={user.firstName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/globe.svg';
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500">
                No users found
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-y-auto h-[calc(100vh-216px)]">
          {conversationsLoading ? (
            <div className="p-4">Loading conversations...</div>
          ) : conversationsData?.getConversations?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No conversations yet. Search for users to start chatting!
            </div>
          ) : (
            conversationsData?.getConversations?.map((conversation: any) => {
              // Extract the other participant for each conversation
              const otherParticipant = conversation.participants.find(
                (p: any) => p.user.id !== currentUserId
              );
              
              return (
                <div
                  key={conversation.id}
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`flex items-center p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                    activeConversationId === conversation.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                      <img 
                        src={otherParticipant?.user?.avatar || '/globe.svg'} 
                        alt={`${otherParticipant?.user?.firstName || 'Unknown'}'s avatar`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/globe.svg';
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="ml-3 flex-grow">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-gray-800">
                        {otherParticipant ? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` : 'Unknown'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(conversation.messages[0]?.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 truncate w-36">
                        {conversation.messages[0]?.content || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Right Side - Active Chat or User Details */}
      {showUserDetails ? (
        <div className={`${showUserDetails ? 'w-full md:w-3/4' : 'hidden'}`}>
          {renderParticipantDetails()}
        </div>
      ) : activeConversationId ? (
        <div className={`${showUserDetails ? 'hidden md:flex md:w-3/4' : 'flex-grow'} flex flex-col`}>
          {/* Chat Header */}
          <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <div 
                className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 cursor-pointer"
                onClick={() => setShowUserDetails(true)}
              >
                <img 
                  src={getParticipantAvatar(activeConversation)} 
                  alt="Participant"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/globe.svg';
                  }}
                />
              </div>
              <div className="ml-3">
                <h2 className="font-medium text-gray-800">
                  {getParticipantName(activeConversation)}
                </h2>
                {otherParticipantDetails?.isEmailVerified && (
                  <div className="flex items-center text-xs text-green-600">
                    <FaCheckCircle className="w-3 h-3 mr-1" />
                    <span>Verified</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-indigo-600">
                <FaPhone className="w-5 h-5" />
              </button>
              <button className="text-gray-600 hover:text-indigo-600">
                <FaVideo className="w-5 h-5" />
              </button>
              <button 
                className="text-gray-600 hover:text-indigo-600"
                onClick={() => setShowUserDetails(true)}
              >
                <FaInfoCircle className="w-5 h-5" />
              </button>
              <div className="relative">
                <button className="text-gray-600 hover:text-indigo-600">
                  <FaEllipsisV className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-grow overflow-y-auto p-4 bg-gray-50">
            {messagesLoading ? (
              <div className="flex justify-center items-center h-full">
                Loading messages...
              </div>
            ) : messagesData?.getMessages?.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center text-gray-500">
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Send a message to start the conversation!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messagesData?.getMessages?.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender.id === currentUserId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender.id === currentUserId
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-1 ${
  msg.sender.id === currentUserId 
    ? 'text-indigo-200' 
    : 'text-gray-500'
}`}>
  {formatTimestamp(msg.createdAt)}
</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Message Input */}
          <div className="bg-white p-4 border-t border-gray-200">
            <div className="flex items-center">
              <button className="text-gray-500 hover:text-indigo-600 mr-2">
                <FaPaperclip className="w-5 h-5" />
              </button>
              <div className="flex-grow bg-gray-100 rounded-full px-4 py-2 flex items-center">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-grow bg-transparent focus:outline-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button className="text-gray-500 hover:text-indigo-600 ml-2">
                  <FaSmile className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleSendMessage}
                className={`ml-2 p-2 rounded-full ${
                  message.trim() ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
                disabled={!message.trim()}
              >
                <FaPaperPlane className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">No conversation selected</h3>
            <p className="mt-1 text-sm text-gray-500">Select a conversation from the list or search for users to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}