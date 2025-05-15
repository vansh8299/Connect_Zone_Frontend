import React, { useState, useRef } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { FaTimes, FaUsers, FaInfoCircle, FaImage } from 'react-icons/fa';
import { HiPhoto } from 'react-icons/hi2';
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      setAvatarFile(null);
      setAvatarPreview(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      setError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image size should be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // ... (keep other existing functions like handleSearchChange, addParticipant, removeParticipant)

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
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      selectedParticipants.forEach((p) => formData.append('participantIds', p.id));
      
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await createGroup({
        variables: {
          input: {
            name: name.trim(),
            description: description.trim() || undefined,
            participantIds: selectedParticipants.map(p => p.id),
            avatarFile: avatarFile || undefined
          }
        },
        context: {
          hasUpload: true // This tells Apollo Client to use multipart form data
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
        {/* Modal header */}
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
            
            {/* Avatar Upload Section */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Group Avatar (Optional)
              </label>
              <div className="flex items-center">
                <div className="mr-4">
                  {avatarPreview ? (
                    <img 
                      src={avatarPreview} 
                      alt="Group avatar preview" 
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <FaImage className="text-gray-400 text-xl" />
                    </div>
                  )}
                </div>
                <div>
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
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                  >
                    <HiPhoto className="h-5 w-5 text-gray-400 mr-2" />
                    {avatarPreview ? "Change Picture" : "Upload Picture"}
                  </button>
                  {avatarFile && (
                    <p className="mt-1 text-sm text-gray-500">
                      {avatarFile.name.length > 20
                        ? `${avatarFile.name.substring(0, 20)}...`
                        : avatarFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Rest of the form (name, description, participants) */}
            {/* ... (keep the existing form fields) */}
            
          </div>
          
          {/* Modal footer */}
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center"
              disabled={creatingGroup || isUploading || !name.trim() || selectedParticipants.length === 0}
            >
              {creatingGroup ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;