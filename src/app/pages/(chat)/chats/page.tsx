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
  GET_GROUP,
  UPDATE_GROUP,
  ADD_GROUP_PARTICIPANTS,
  REMOVE_GROUP_PARTICIPANT,
  LEAVE_GROUP,
  DELETE_GROUP
} from '@/graphql/query/chatquery';
import { GET_USER_BY_ID } from '@/graphql/query/query';
import { FaPaperclip, FaSmile, FaPaperPlane, FaPhone, FaVideo, FaInfoCircle, FaEllipsisV, FaCheckCircle, FaTimes, FaUsers, FaEdit, FaUserPlus, FaCheck, FaTrash, FaSignOutAlt } from 'react-icons/fa';
import { useSocket } from '@/utils/SocketContext';
import CreateGroupModal from '@/components/groupmodal';

export default function ChatPage() {
  // State
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [otherParticipantDetails, setOtherParticipantDetails] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationId = useRef<string | null>(null);

  // Hooks
  const client = useApolloClient();
  const { socket, isConnected } = useSocket();
  const extractUserIdFromToken = (token: string): string | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload.userId || null;
    } catch (error) {
      console.error('Error extracting user ID:', error);
      return null;
    }
  };
  // Get token and extract user ID
  const token = getCookie('token');
  const currentUserId = token ? extractUserIdFromToken(String(token)) : 'guest-user';

  // Fetch conversations query
  const { data: conversationsData, loading: conversationsLoading } = useQuery(GET_CONVERSATIONS, {
    
    onCompleted: (data: { getConversations: any[] }) => {
      if (data?.getConversations?.length > 0 && !activeConversationId) {
        console.log(data)
        setActiveConversationId(data.getConversations[0].id);
        
        const firstConversation = data.getConversations[0];
        if (!firstConversation.isGroup) {
          const otherParticipant = firstConversation.participants.find(
            (p: any) => p.user.id !== currentUserId
          );
          if (otherParticipant) {
            fetchUserDetails(otherParticipant.user.id);
          }
        }
      }
    }
  });

  // Fetch group details when active conversation is a group
  const { data: groupData, loading: groupLoading, refetch: refetchGroup } = useQuery(GET_GROUP, {
    variables: { groupId: activeConversationId },
    skip: !activeConversationId || !conversationsData?.getConversations?.find((c: any) => c.id === activeConversationId)?.isGroup,
    onCompleted: (data) => {
      if (data?.getGroup) {
        setGroupDetails(data.getGroup);
        setGroupName(data.getGroup.name);
        setGroupDescription(data.getGroup.description || '');
      }
    }
  });

  // Search users query
  const { data: groupSearchData, loading: groupSearchLoading } = useQuery(SEARCH_USERS, {
    variables: { searchTerm: groupSearchTerm },
    skip: groupSearchTerm.length < 2
  });

  // Get user by ID query
  const [getUserById, { loading: userDetailsLoading }] = useLazyQuery(GET_USER_BY_ID, {
    onCompleted: (data) => {
      if (data?.user) {
        setOtherParticipantDetails(data.user);
      }
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
    }
  });

  // Get user by email query
  const [getUserByEmail] = useLazyQuery(GET_USER_BY_EMAIL, {
    onCompleted: (data: any) => {
      if (data?.userByEmail) {
        startConversation(data.userByEmail.id);
        setSearchResults([data.userByEmail]);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    }
  });

  // Mutations
  const [sendMessage] = useMutation(SEND_MESSAGE);
  const [createConversation] = useMutation(CREATE_CONVERSATION);
  const [updateGroup] = useMutation(UPDATE_GROUP);
  const [addGroupParticipants] = useMutation(ADD_GROUP_PARTICIPANTS);
  const [removeGroupParticipant] = useMutation(REMOVE_GROUP_PARTICIPANT);
  const [leaveGroup] = useMutation(LEAVE_GROUP);
  const [deleteGroup] = useMutation(DELETE_GROUP);

  // Get the current active conversation
  const activeConversation = activeConversationId && conversationsData?.getConversations 
    ? conversationsData.getConversations.find((c: any) => c.id === activeConversationId)
    : null;

  // Check if current user is admin of the group
  const isGroupAdmin = groupDetails?.creator?.id === currentUserId;

  // Socket message handling
  useEffect(() => {
    if (!socket) return;
      
    const handleNewMessage = (data: { type: string; payload: any }) => {
      if (data.type === 'NEW_MESSAGE') {
        const newMessage = data.payload;
              
        if (!newMessage || !newMessage.conversationId) return;
        
        if (newMessage.conversationId === activeConversationId) {
          try {
            const existingMessages = client.readQuery({
              query: GET_MESSAGES,
              variables: { conversationId: activeConversationId }
            })?.getMessages || [];
            
            if (!existingMessages.some((msg: any) => msg.id === newMessage.id)) {
              client.writeQuery({
                query: GET_MESSAGES,
                variables: { conversationId: activeConversationId },
                data: { getMessages: [...existingMessages, newMessage] }
              });
              
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          } catch (err) {
            console.error("Error updating cache:", err);
          }
        }
        
        setReceivedMessages(prev => {
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
              
        client.refetchQueries({ include: [GET_CONVERSATIONS] });
      }
    };
      
    socket.on('message', handleNewMessage);
    return () => {
      socket.off('message', handleNewMessage);
    };
  }, [socket, client, activeConversationId]);

  // Socket room management
  useEffect(() => {
    if (!socket || !isConnected || !activeConversationId) return;
    
    if (prevConversationId.current && prevConversationId.current !== activeConversationId) {
      socket.emit('leaveConversation', prevConversationId.current);
    }
    
    socket.emit('joinConversation', activeConversationId);
    prevConversationId.current = activeConversationId;
    
    return () => {
      if (activeConversationId) {
        socket.emit('leaveConversation', activeConversationId);
      }
    };
  }, [socket, isConnected, activeConversationId]);

  // Handle reconnection
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      if (activeConversationId) {
        socket.emit('joinConversation', activeConversationId);
        refetchMessages();
      }
    };

    socket.on('reconnect', handleReconnect);
    return () => {
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, activeConversationId, refetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.getMessages?.length]);

  // Fetch user details when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !conversationsData) return;
    
    const activeConv = conversationsData.getConversations.find(
      (conv: any) => conv.id === activeConversationId
    );
    
    if (activeConv && !activeConv.isGroup) {
      const otherParticipant = activeConv.participants.find(
        (p: any) => p.user.id !== currentUserId
      );
      if (otherParticipant) {
        fetchUserDetails(otherParticipant.user.id);
      } else {
        setOtherParticipantDetails(null);
      }
    } else {
      setOtherParticipantDetails(null);
    }
  }, [activeConversationId, conversationsData, currentUserId]);

  // Combined messages with proper sorting
  const allMessages = useMemo(() => {
    const serverMessages = messagesData?.getMessages || [];
    const newMessages = receivedMessages.filter(
      msg => msg.conversationId === activeConversationId
    );
    
    const messagesMap = new Map();
    serverMessages.forEach((msg: { id: any; }) => messagesMap.set(msg.id, msg));
    newMessages.forEach(msg => messagesMap.set(msg.id, msg));
    
    return Array.from(messagesMap.values()).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messagesData?.getMessages, receivedMessages, activeConversationId]);

  // Helper functions
  const formatTimestamp = (timestamp: string | number | Date) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  

  const getParticipantName = (conversation: any) => {
    if (!conversation) return 'Unknown';
    if (conversation.isGroup) {
      return conversation.name || conversation.participants
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
  if (conversation.isGroup) {
    // Use the group's avatar if available, otherwise fallback to default
    return conversation.group?.avatar || '/group-avatar.svg';
  }
  const otherParticipant = conversation.participants.find(
    (p: any) => p.user.id !== currentUserId
  );
  return otherParticipant?.user?.avatar || '/globe.svg';
};

  const fetchUserDetails = (userId: string) => {
    getUserById({ variables: { id: userId } });
  };

  // Message handling
  const handleSendMessage = async () => {
    if (!message.trim() || !activeConversationId) return;
    
    const messageContent = message.trim();
    const optimisticId = `temp-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    setMessage('');
    
    // Optimistic UI update
    const optimisticMessage = {
      __typename: 'Message',
      id: optimisticId,
      content: messageContent,
      sender: { __typename: 'User', id: currentUserId, firstName: 'You', lastName: '', avatar: '' },
      readBy: [{
        __typename: 'MessageRead',
        id: `read-${optimisticId}`,
        user: { __typename: 'User', id: currentUserId, firstName: 'You', lastName: '', avatar: '' },
        readAt: timestamp
      }],
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'TEXT',
      conversationId: activeConversationId
    };
    
    const currentMessages = client.readQuery({
      query: GET_MESSAGES,
      variables: { conversationId: activeConversationId }
    })?.getMessages || [];
    
    client.writeQuery({
      query: GET_MESSAGES,
      variables: { conversationId: activeConversationId },
      data: { getMessages: [...currentMessages, optimisticMessage] }
    });
    
    try {
      const response = await sendMessage({
        variables: {
          input: {
            conversationId: activeConversationId,
            content: messageContent
          }
        }
      });
      
      if (socket && isConnected) {
        const participants = conversationsData?.getConversations
          .find((c: any) => c.id === activeConversationId)?.participants || [];
        
        const receiverIds = participants
          .filter((p: any) => p.user.id !== currentUserId)
          .map((p: any) => p.user.id);
        
        socket.emit('message', {
          ...response.data.sendMessage,
          receivers: receiverIds,
          conversationId: activeConversationId
        });
      }
      
      client.writeQuery({
        query: GET_MESSAGES,
        variables: { conversationId: activeConversationId },
        data: {
          getMessages: [
            ...currentMessages.filter((msg: any) => msg.id !== optimisticId),
            response.data.sendMessage
          ]
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      client.writeQuery({
        query: GET_MESSAGES,
        variables: { conversationId: activeConversationId },
        data: { getMessages: currentMessages.filter((msg: any) => msg.id !== optimisticId) }
      });
    }
  };

  // Search handling
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(term)) {
      getUserByEmail({ variables: { email: term } });
    } else {
      const searchTimer = setTimeout(() => {
        searchUsersQuery({ variables: { searchTerm: term } });
      }, 300);
      
      return () => clearTimeout(searchTimer);
    }
  };

  // Start conversation
  const startConversation = async (userId: string) => {
    try {
      await createConversation({
        variables: { participantIds: [userId] }
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Group functions
  const handleGroupCreated = (groupId: string) => {
    setActiveConversationId(groupId);
    setIsCreateGroupModalOpen(false);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    
    try {
      await updateGroup({
        variables: {
          input: {
            groupId: activeConversationId,
            name: groupName.trim(),
            description: groupDescription.trim() || undefined
          }
        }
      });
      setIsEditingGroup(false);
      refetchGroup();
    } catch (error) {
      console.error('Error updating group:', error);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    try {
      await addGroupParticipants({
        variables: { groupId: activeConversationId, participantIds: [userId] }
      });
      setGroupSearchTerm('');
      refetchGroup();
    } catch (error) {
      console.error('Error adding participant:', error);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      console.log(userId)
      await removeGroupParticipant({
        variables: { groupId: activeConversationId, participantId: userId }
      });
      refetchGroup();
    } catch (error) {
      console.error('Error removing participant:', error);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await leaveGroup({ variables: { groupId: activeConversationId } });
      setActiveConversationId(null);
      setShowDetails(false);
      setShowLeaveConfirm(false);
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await deleteGroup({ variables: { groupId: activeConversationId } });
      setActiveConversationId(null);
      setShowDetails(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const isUserInGroup = (userId: string) => {
    return groupDetails?.participants?.some((p: any) => p.user.id === userId);
  };

  // Render participant details (for 1:1 chats)
  const renderUserDetails = () => {
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
            onClick={() => setShowDetails(false)}
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
              onError={(e) => (e.target as HTMLImageElement).src = '/globe.svg'}
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

  // Render group details
  const renderGroupDetails = () => {
    if (groupLoading || !groupDetails) return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="rounded-full bg-gray-200 h-20 w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mt-4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6 mt-4"></div>
        </div>
      </div>
    );

    return (
      <div className="participant-details p-6 bg-white h-full overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-gray-800">Group Details</h2>
          <button 
            onClick={() => setShowDetails(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-4 flex items-center justify-center">
  {groupDetails.avatar ? (
    <img
      src={groupDetails.avatar}
      alt={groupDetails.name}
      className="w-full h-full object-cover"
      onError={(e) => (e.target as HTMLImageElement).src = '/group-avatar.svg'}
    />
  ) : (
    <FaUsers className="w-12 h-12 text-indigo-600" />
  )}
</div>
          
          {isEditingGroup ? (
            <form onSubmit={handleUpdateGroup} className="w-full max-w-xs">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full p-2 border rounded mb-2"
                required
              />
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="w-full p-2 border rounded mb-2"
                placeholder="Group description"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingGroup(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 className="text-2xl font-semibold text-gray-800">
                {groupDetails.name}
              </h3>
              <p className="text-gray-500 mt-1">
                {groupDetails.participants?.length || 0} members
              </p>
              {isGroupAdmin && (
                <button
                  onClick={() => setIsEditingGroup(true)}
                  className="mt-2 text-indigo-600 hover:text-indigo-800"
                >
                  <FaEdit className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
        
        <div className="space-y-6">
          {groupDetails.description && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
              <p className="text-gray-800 whitespace-pre-wrap">
                {groupDetails.description}
              </p>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Created by</h4>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-3">
                <img
                  src={groupDetails.creator?.avatar || '/globe.svg'}
                  alt={groupDetails.creator?.firstName}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target as HTMLImageElement).src = '/globe.svg'}
                />
              </div>
              <span className="text-gray-800">
                {groupDetails.creator?.firstName} {groupDetails.creator?.lastName}
                {groupDetails.creator?.id === currentUserId && ' (You)'}
              </span>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Participants</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {groupDetails.participants?.map((participant: any) => (
                <div key={participant.user.id} className="flex items-center">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                    <img
                      src={participant.user.avatar || '/globe.svg'}
                      alt={participant.user.firstName}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target as HTMLImageElement).src = '/globe.svg'}
                    />
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium text-gray-800">
                      {participant.user.firstName} {participant.user.lastName}
                      {participant.user.id === currentUserId && ' (You)'}
                    </p>
                    {participant.user.id === groupDetails.creator?.id && (
                      <p className="text-xs text-indigo-600">Admin</p>
                    )}
                  </div>
                  {isGroupAdmin && participant.user.id !== currentUserId && (
                    <button
                      onClick={() => handleRemoveParticipant(participant.user.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Add Participants Section (Admin only) */}
          {isGroupAdmin && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Add Participants</h4>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users to add..."
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                />
                
                {groupSearchLoading && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500 text-sm">
                    Searching...
                  </div>
                )}
                
                {groupSearchTerm && groupSearchData?.searchUsers?.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                    {groupSearchData.searchUsers.map((user: any) => (
                      <div
                        key={user.id}
                        className={`p-2 hover:bg-gray-100 flex items-center justify-between ${
                          isUserInGroup(user.id) ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        onClick={() => !isUserInGroup(user.id) && handleAddParticipant(user.id)}
                      >
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-2">
                            <img
                              src={user.avatar || '/globe.svg'}
                              alt={user.firstName}
                              className="w-full h-full object-cover"
                              onError={(e) => (e.target as HTMLImageElement).src = '/globe.svg'}
                            />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                        
                        {isUserInGroup(user.id) ? (
                          <span className="text-xs text-green-600 flex items-center">
                            <FaCheck className="w-3 h-3 mr-1" />
                            Added
                          </span>
                        ) : (
                          <button className="text-indigo-600 hover:text-indigo-800">
                            <FaUserPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="border-t border-gray-200 pt-4 flex flex-col space-y-2">
            {isGroupAdmin ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete Group
              </button>
            ) : (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Leave Group
              </button>
            )}
            <button
              onClick={() => setShowDetails(false)}
              className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-128px)] bg-gray-100">
      {/* Left Sidebar - Conversation List */}
      <div className={`${showDetails ? 'hidden md:block md:w-1/4' : 'w-1/4'} bg-white border-r border-gray-200`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold text-gray-800">Messages</h1>
            <button 
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
              title="Create group"
            >
              <FaUsers className="w-4 h-4" />
            </button>
          </div>
          
          <div className="mt-2 relative">
            <input
              type="text"
              placeholder="Search users or enter email..."
              className="w-full p-2 bg-gray-100 rounded-lg text-sm"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            
            {isSearching && searchLoading && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500">
                Searching...
              </div>
            )}
            
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
                        onError={(e) => (e.target as HTMLImageElement).src = '/globe.svg'}
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
       <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 mr-3">
  <img 
    src={
      conversation.isGroup 
        ? (conversation.group?.avatar || conversation.avatar || '/group-avatar.svg')
        : (otherParticipant?.user?.avatar || '/globe.svg')
    } 
    alt={
      conversation.isGroup 
        ? conversation.group?.name || 'Group'
        : `${otherParticipant?.user?.firstName || 'Unknown'}'s avatar`
    }
    className="w-full h-full object-cover"
    onError={(e) => {
      (e.target as HTMLImageElement).src = conversation.isGroup 
        ? '/group-avatar.svg' 
        : '/globe.svg'
    }}
  />
</div>
                  </div>
                  
                  <div className="ml-3 flex-grow">
                    <div className="flex justify-between items-center">
                     <h3 className="font-medium text-gray-800">
  {conversation.isGroup 
    ? (conversation.group?.name || conversation.name || 'Group Chat')
    : (otherParticipant?.user?.firstName || 'Unknown')}
</h3>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(conversation.messages[0]?.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600 truncate w-36">
                        {conversation.messages[0]?.content || 'No messages yet'}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="bg-indigo-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Right Side - Active Chat or Details */}
      {showDetails ? (
        <div className={`${showDetails ? 'w-full md:w-3/4' : 'hidden'}`}>
          {activeConversation?.isGroup ? renderGroupDetails() : renderUserDetails()}
        </div>
      ) : activeConversationId ? (
        <div className={`${showDetails ? 'hidden md:flex md:w-3/4' : 'flex-grow'} flex flex-col`}>
          {/* Chat Header */}
          <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center">
              <div 
                className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 cursor-pointer mr-3"
                onClick={() => setShowDetails(true)}
              >
                <img 
                  src={getParticipantAvatar(activeConversation)} 
                  alt={activeConversation?.isGroup ? "Group" : "Participant"}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target as HTMLImageElement).src = '/globe.svg'}
                />
              </div>
              <div>
                <h2 className="font-medium text-gray-800">
                  {getParticipantName(activeConversation)}
                </h2>
                {!activeConversation?.isGroup && otherParticipantDetails?.isEmailVerified && (
                  <div className="flex items-center text-xs text-green-600">
                    <FaCheckCircle className="w-3 h-3 mr-1" />
                    <span>Verified</span>
                  </div>
                )}
                {activeConversation?.isGroup && (
                  <div className="text-xs text-gray-500">
                    {activeConversation.participants.length} members
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
                onClick={() => setShowDetails(true)}
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
            ) : allMessages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center text-gray-500">
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Send a message to start the conversation!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {allMessages.map((msg: any) => (
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
                        {msg.sender.id === currentUserId && (
                          <span className="ml-1">
                            {msg.readBy?.length > 1 ? (
                              <FaCheckCircle className="inline text-blue-300" />
                            ) : (
                              <FaCheck className="inline" />
                            )}
                          </span>
                        )}
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

      {/* Create Group Modal */}
      {isCreateGroupModalOpen && (
        <CreateGroupModal 
          isOpen={isCreateGroupModalOpen}
          onClose={() => setIsCreateGroupModalOpen(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Delete Group</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this group? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Leave Group Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Leave Group</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to leave this group? You'll need to be invited back.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveGroup}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
              }
              