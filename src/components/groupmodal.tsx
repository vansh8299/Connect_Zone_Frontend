import React, { useState, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { FaTimes, FaUsers, FaInfoCircle, FaImage, FaSearch, FaPlus } from 'react-icons/fa';
import { HiPhoto } from 'react-icons/hi2';
import { CREATE_GROUP, SEARCH_USERS, GET_CONVERSATIONS, GET_USER_GROUPS } from '../graphql/query/chatquery';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatar?: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // GraphQL operations
  const [createGroup, { loading: creatingGroup }] = useMutation(CREATE_GROUP, {
    onCompleted: (data) => {
      if (data?.createGroup?.id && onGroupCreated) {
        onGroupCreated(data.createGroup.id);
      }
      onClose();
      // Reset form
      resetForm();
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      setError(error.message || 'Failed to create group. Please try again.');
    },
    refetchQueries: [{ query: GET_CONVERSATIONS }, { query: GET_USER_GROUPS }]
  });
  
  const { data: searchData, loading: searchLoading } = useQuery(SEARCH_USERS, {
    variables: { searchTerm },
    skip: searchTerm.length < 2,
    onError: (error) => {
      console.error('Error searching users:', error);
    }
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setSearchTerm('');
    setSelectedParticipants([]);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarBase64(null);
    setError(null);
    setIsSearching(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match('image.*')) {
      setError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setError(null);

    // Create preview and base64 for upload
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAvatarPreview(result);
      setAvatarBase64(result); // Store base64 for GraphQL mutation
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsSearching(value.length >= 2);
  };

  const addParticipant = (user: User) => {
    if (!selectedParticipants.find(p => p.id === user.id)) {
      setSelectedParticipants([...selectedParticipants, user]);
    }
    setSearchTerm('');
    setIsSearching(false);
  };

  const removeParticipant = (userId: string) => {
    setSelectedParticipants(selectedParticipants.filter(p => p.id !== userId));
  };

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
      const input = {
        name: name.trim(),
        description: description.trim() || undefined,
        participantIds: selectedParticipants.map(p => p.id),
        avatarBase64: avatarBase64 || undefined // Send base64 string
      };

      await createGroup({
        variables: { input }
      });
    } catch (err) {
      console.error('Create group error:', err);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;
  
  const searchResults = searchData?.searchUsers?.filter(
    (user: User) => !selectedParticipants.find(p => p.id === user.id)
  ) || [];
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-screen overflow-y-auto">
        {/* Modal header */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-800">Create New Group</h2>
          <button 
            onClick={handleClose} 
            className="text-gray-500 hover:text-gray-700 transition-colors"
            type="button"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleCreateGroup}>
          <div className="p-4 space-y-4">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg border border-red-200">
                <div className="flex items-center">
                  <FaInfoCircle className="mr-2 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
            
            {/* Avatar Upload Section */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Group Avatar (Optional)
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 relative">
                  {avatarPreview ? (
                    <div className="relative">
                      <img 
                        src={avatarPreview} 
                        alt="Group avatar preview" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <FaTimes className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                      <FaImage className="text-gray-400 text-lg" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  >
                    <HiPhoto className="h-4 w-4 text-gray-400 mr-2" />
                    {avatarPreview ? "Change Picture" : "Upload Picture"}
                  </button>
                  {avatarFile && (
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {avatarFile.name.length > 20
                        ? `${avatarFile.name.substring(0, 20)}...`
                        : avatarFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Group Name */}
            <div>
              <label htmlFor="groupName" className="block text-gray-700 text-sm font-bold mb-2">
                Group Name *
              </label>
              <input
                id="groupName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                maxLength={50}
                required
              />
              <p className="mt-1 text-xs text-gray-500">{name.length}/50 characters</p>
            </div>

            {/* Group Description */}
            <div>
              <label htmlFor="groupDescription" className="block text-gray-700 text-sm font-bold mb-2">
                Description (Optional)
              </label>
              <textarea
                id="groupDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="mt-1 text-xs text-gray-500">{description.length}/200 characters</p>
            </div>

            {/* Add Participants */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Add Participants *
              </label>
              
              {/* Search Users */}
              <div className="relative mb-3">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder="Search users by name or email..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                {/* Search Results */}
                {isSearching && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {searchLoading ? (
                      <div className="p-3 text-center text-gray-500">
                        <div className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full mr-2"></div>
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((user: User) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addParticipant(user)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 border-b border-gray-100 last:border-b-0"
                        >
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt={`${user.firstName} ${user.lastName}`}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            {user.email && (
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            )}
                          </div>
                          <FaPlus className="w-4 h-4 text-gray-400" />
                        </button>
                      ))
                    ) : searchTerm.length >= 2 ? (
                      <div className="p-3 text-center text-gray-500 text-sm">
                        No users found
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Selected Participants */}
              {selectedParticipants.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <FaUsers className="mr-2 h-4 w-4" />
                    Selected Participants ({selectedParticipants.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                    {selectedParticipants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-3">
                          {participant.avatar ? (
                            <img 
                              src={participant.avatar} 
                              alt={`${participant.firstName} ${participant.lastName}`}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                {participant.firstName?.[0]}{participant.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {participant.firstName} {participant.lastName}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <FaTimes className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Modal footer */}
          <div className="flex justify-end p-4 border-t bg-gray-50 space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              disabled={creatingGroup}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center font-medium transition-colors"
              disabled={creatingGroup || !name.trim() || selectedParticipants.length === 0}
            >
              {creatingGroup ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;