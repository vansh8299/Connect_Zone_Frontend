// src/components/group/GroupDetails.tsx
import React, { useState } from 'react';
import { FaTimes, FaUserPlus, FaUsers, FaEdit, FaTrash, FaSignOutAlt, FaCheck, FaCamera } from 'react-icons/fa';
import { useMutation, useQuery } from '@apollo/client';
import { UPDATE_GROUP, ADD_GROUP_PARTICIPANTS, REMOVE_GROUP_PARTICIPANT, LEAVE_GROUP, DELETE_GROUP, GET_GROUP } from '@/graphql/query/chatquery';
import { SEARCH_USERS } from '@/graphql/query/chatquery';
import { GET_CONVERSATIONS } from '@/graphql/query/chatquery';
import { GET_USER_GROUPS } from '@/graphql/query/chatquery';

interface GroupDetailsProps {
  groupId: string;
  onClose: () => void;
  currentUserId: string;
}

const GroupDetails: React.FC<GroupDetailsProps> = ({ groupId, onClose, currentUserId }) => {
  // State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // GraphQL queries
  const { data: groupData, loading: groupLoading } = useQuery(GET_GROUP, {
    variables: { groupId },
    onCompleted: (data) => {
      if (data?.getGroup) {
        setName(data.getGroup.name);
        setDescription(data.getGroup.description || '');
      }
    }
  });
  
  const { data: searchData, loading: searchLoading } = useQuery(SEARCH_USERS, {
    variables: { searchTerm },
    skip: searchTerm.length < 2
  });
  
  // GraphQL mutations
  const [updateGroup, { loading: updating }] = useMutation(UPDATE_GROUP, {
    onCompleted: () => {
      setIsEditing(false);
    },
    refetchQueries: [{ query: GET_GROUP, variables: { groupId } }]
  });
  
  const [addGroupParticipants] = useMutation(ADD_GROUP_PARTICIPANTS, {
    refetchQueries: [{ query: GET_GROUP, variables: { groupId } }]
  });
  
  const [removeGroupParticipant] = useMutation(REMOVE_GROUP_PARTICIPANT, {
    refetchQueries: [{ query: GET_GROUP, variables: { groupId } }]
  });
  
  const [leaveGroup] = useMutation(LEAVE_GROUP, {
    onCompleted: () => {
      onClose();
    },
    refetchQueries: [{ query: GET_CONVERSATIONS }, { query: GET_USER_GROUPS }]
  });
  
  const [deleteGroup] = useMutation(DELETE_GROUP, {
    onCompleted: () => {
      onClose();
    },
    refetchQueries: [{ query: GET_CONVERSATIONS }, { query: GET_USER_GROUPS }]
  });
  
  // Check if the current user is the group admin
  const isAdmin = groupData?.getGroup?.admin?.id === currentUserId;
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length >= 2) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  };
  
  // Add participant to group
  const handleAddParticipant = async (userId: string) => {
    try {
      await addGroupParticipants({
        variables: {
          groupId,
          participantIds: [userId]
        }
      });
      
      // Clear search after adding
      setSearchTerm('');
    } catch (error) {
      console.error('Error adding participant:', error);
      alert('Failed to add participant. Please try again.');
    }
  };
  
  // Remove participant from group
  const handleRemoveParticipant = async (userId: string) => {
    try {
      await removeGroupParticipant({
        variables: {
          groupId,
          participantId: userId
        }
      });
    } catch (error) {
      console.error('Error removing participant:', error);
      alert('Failed to remove participant. Please try again.');
    }
  };
  
  // Handle group update
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Group name cannot be empty');
      return;
    }
    
    try {
      await updateGroup({
        variables: {
          input: {
            groupId,
            name: name.trim(),
            description: description.trim() || undefined
          }
        }
      });
    } catch (error) {
      console.error('Error updating group:', error);
      alert('Failed to update group. Please try again.');
    }
  };
  
  // Leave group
  const handleLeaveGroup = async () => {
    try {
      await leaveGroup({
        variables: { groupId }
      });
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('Failed to leave group. Please try again.');
    }
  };
  
  // Delete group
  const handleDeleteGroup = async () => {
    try {
      await deleteGroup({
        variables: { groupId }
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group. Please try again.');
    }
  };
  
  // Check if a user is already in the group
  const isUserInGroup = (userId: string) => {
    return groupData?.getGroup?.participants.some((p: any) => p.user.id === userId);
  };
  
  // Loading state
  if (groupLoading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="animate-pulse flex flex-col items-center">
            <div className="rounded-full bg-gray-200 h-20 w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mt-4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6 mt-4"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Group Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {/* Group Info Section */}
          <div className="p-4 border-b">
            {isEditing ? (
              <form onSubmit={handleUpdateGroup}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupName">
                    Group Name
                  </label>
                  <input
                    id="groupName"
                    type="text"
                    placeholder="Enter group name"
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupDescription">
                    Description (Optional)
                  </label>
                  <textarea
                    id="groupDescription"
                    placeholder="Enter group description"
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
                    disabled={updating || !name.trim()}
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                      <FaUsers className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{groupData?.getGroup?.name}</h3>
                      <p className="text-sm text-gray-500">
                        {groupData?.getGroup?.participants?.length || 0} participants
                      </p>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      <FaEdit className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                {groupData?.getGroup?.description && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                    <p className="text-gray-600 text-sm">
                      {groupData.getGroup.description}
                    </p>
                  </div>
                )}
                
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Created by</h4>
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-2">
                      <img
                        src={groupData?.getGroup?.admin?.avatar || '/globe.svg'}
                        alt={groupData?.getGroup?.admin?.firstName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/globe.svg';
                        }}
                      />
                    </div>
                    <span className="text-sm">
                      {groupData?.getGroup?.admin?.firstName} {groupData?.getGroup?.admin?.lastName}
                      {groupData?.getGroup?.admin?.id === currentUserId && ' (You)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Search and Add Participants Section (Admin only) */}
          {isAdmin && (
            <div className="p-4 border-b">
              <h3 className="font-medium text-gray-800 mb-2">Add Participants</h3>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users to add..."
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
                    {searchData.searchUsers.map((user: any) => {
                      const isInGroup = isUserInGroup(user.id);
                      return (
                        <div
                          key={user.id}
                          className={`p-2 hover:bg-gray-100 flex items-center justify-between ${
                            isInGroup ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-2">
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
                          
                          {isInGroup ? (
                            <span className="text-xs text-green-600 flex items-center">
                              <FaCheck className="w-3 h-3 mr-1" />
                              Added
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddParticipant(user.id)}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              <FaUserPlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {isSearching && searchTerm.length >= 2 && searchData?.searchUsers?.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg p-2 text-center text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Participants List */}
          <div className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">
              Participants ({groupData?.getGroup?.participants?.length || 0})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {groupData?.getGroup?.participants?.map((participant: any) => (
                <div
                  key={participant.user.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                      <img
                        src={participant.user.avatar || '/globe.svg'}
                        alt={participant.user.firstName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/globe.svg';
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-medium">
                        {participant.user.firstName} {participant.user.lastName}
                        {participant.user.id === currentUserId && ' (You)'}
                      </div>
                      {participant.user.id === groupData?.getGroup?.admin?.id && (
                        <div className="text-xs text-indigo-600">Admin</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Admin can remove others, users can't be removed if they're admin */}
                  {isAdmin && participant.user.id !== currentUserId && (
                    <button
                      onClick={() => handleRemoveParticipant(participant.user.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove participant"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="p-4 border-t mt-auto">
          {isAdmin ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center"
            >
              <FaTrash className="w-4 h-4 mr-2" />
              Delete Group
            </button>
          ) : (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center"
            >
              <FaSignOutAlt className="w-4 h-4 mr-2" />
              Leave Group
            </button>
          )}
        </div>
        
        {/* Delete Group Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Delete Group</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this group? This action cannot be undone and will
                remove the group for all participants.
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
                Are you sure you want to leave this group? You'll need to be added back by an admin
                to rejoin.
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
    </div>
  );
};

export default GroupDetails;