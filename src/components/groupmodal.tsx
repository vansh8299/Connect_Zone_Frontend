import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { FaTimes, FaUsers, FaInfoCircle } from 'react-icons/fa';
import { CREATE_GROUP, SEARCH_USERS, GET_CONVERSATIONS, GET_USER_GROUPS } from '../graphql/query/chatquery';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // GraphQL operations
  const [createGroup, { loading: creatingGroup }] = useMutation(CREATE_GROUP, {
    onCompleted: (data) => {
      if (data?.createGroup?.id && onGroupCreated) {
        onGroupCreated(data.createGroup.id);
      }
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setSearchTerm('');
      setSelectedParticipants([]);
      setError(null);
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      setError(error.message || 'Failed to create group. Please try again.');
    },
    refetchQueries: [{ query: GET_CONVERSATIONS }, { query: GET_USER_GROUPS }]
  });
  
  const { data: searchData, loading: searchLoading } = useQuery(SEARCH_USERS, {
    variables: { searchTerm },
    skip: searchTerm.length < 2
  });
  
  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length >= 2) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  };
  
  // Add participant to selection
  const addParticipant = (user: any) => {
    if (!selectedParticipants.some(p => p.id === user.id)) {
      setSelectedParticipants([...selectedParticipants, user]);
    }
    setSearchTerm('');
    setIsSearching(false);
  };
  
  // Remove participant from selection
  const removeParticipant = (userId: string) => {
    setSelectedParticipants(selectedParticipants.filter(p => p.id !== userId));
  };
  
  // Create group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }
    
    if (selectedParticipants.length === 0) {
      setError('Please select at least one participant');
      return;
    }
    
    try {
      await createGroup({
        variables: {
          input: {
            name: name.trim(),
            description: description.trim() || undefined,
            participantIds: selectedParticipants.map(p => p.id)
          }
        }
      });
    } catch (err) {
      // Error is handled in onError callback
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Create New Group</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleCreateGroup}>
          <div className="p-4">
            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                Group Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Enter group name"
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
                Description (Optional)
              </label>
              <textarea
                id="description"
                placeholder="Enter group description"
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Add Participants
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users to add"
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                
                {isSearching && searchLoading && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500">
                    Searching...
                  </div>
                )}
                
                {isSearching && searchData?.searchUsers?.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchData.searchUsers.map((user: any) => (
                      <div
                        key={user.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
                        onClick={() => addParticipant(user)}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                          <img
                            src={user.avatar || '/globe.svg'}
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
                
                {isSearching && searchTerm.length >= 2 && searchData?.searchUsers?.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </div>
            
            {selectedParticipants.length > 0 && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <div className="flex items-center">
                    <FaUsers className="mr-2" />
                    Selected Participants ({selectedParticipants.length})
                  </div>
                </label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-gray-50">
                  {selectedParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full flex items-center"
                    >
                      <img
                        src={participant.avatar || '/globe.svg'}
                        alt={participant.firstName}
                        className="w-6 h-6 rounded-full mr-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/globe.svg';
                        }}
                      />
                      <span className="text-sm">{participant.firstName}</span>
                      <button
                        onClick={() => removeParticipant(participant.id)}
                        className="ml-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <FaTimes className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center text-gray-600 text-sm mt-4">
              <FaInfoCircle className="mr-2" />
              <span>You'll be added as the group creator automatically</span>
            </div>
          </div>
          
          <div className="flex justify-end p-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 mr-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
              disabled={creatingGroup || !name.trim() || selectedParticipants.length === 0}
            >
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;