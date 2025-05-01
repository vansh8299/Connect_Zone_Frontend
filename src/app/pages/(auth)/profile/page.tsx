"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  FaUser,
  FaEdit,
  FaCheckCircle,
  FaEnvelope,
  FaLock,
  FaSignOutAlt,
  FaTimes,
  FaCamera,
} from "react-icons/fa";
import { useQuery, useMutation } from "@apollo/client";
import { GET_USER_BY_ID } from "@/graphql/query/query";
import { UPDATE_USER } from "@/graphql/query/query";
import { UpdateUserInput, UpdateUserResponse } from "@/utils/type";
import { getCookie } from "cookies-next";
import { extractUserIdFromToken } from "@/utils/extractidfromtoken";
import { deleteCookie } from "cookies-next";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  about?: string;
  isEmailVerified: boolean;
  avatar?: string;
  googleId?: string;
}

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  about: string;
  isEmailVerified: boolean;
  avatar?: string;
  googleId?: string;
}

interface GetUserResponse {
  user: User;
}

export default function ProfilePage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [formData, setFormData] = useState<UserFormData>({
    firstName: "",
    lastName: "",
    email: "",
    about: "",
    isEmailVerified: false,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get token from cookies
  const token = getCookie("token");
  const userId = token ? extractUserIdFromToken(String(token)) : null;

  // Redirect to login if no token or user ID
  useEffect(() => {
    if (!token || !userId) {
      router.push("/pages/login");
    }
  }, [token, userId, router]);

  // Fetch user data from GraphQL
  const { loading, error, data } = useQuery<GetUserResponse>(GET_USER_BY_ID, {
    variables: { id: userId },
    skip: !userId, // Skip query if no userId
  });

  // Initialize update user mutation
  const [updateUser, { loading: updating, error: updateError }] = useMutation<
    UpdateUserResponse,
    { input: UpdateUserInput }
  >(UPDATE_USER, {
    onCompleted: (data) => {
      console.log("Profile updated successfully", data);
      setIsEditing(false);
      // Reset avatar preview
      setAvatarPreview(null);
      setAvatarFile(null);
    },
    onError: (error) => {
      console.error("Error updating profile:", error);
    },
  });

  // Update form data when user data is loaded
  useEffect(() => {
    if (data && data.user) {
      const userData = data.user;
      console.log("User data:", userData);
      setFormData({
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        email: userData.email || "",
        about: userData.about || "",
        isEmailVerified: userData.isEmailVerified || false,
      });
    }
  }, [data]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // In your ProfilePage component
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      const variables: { input: UpdateUserInput } = {
        input: {
          id: userId,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          about: formData.about,
        },
      };

      // Include avatar as base64 if one was selected
      if (avatarFile) {
        // Convert file to base64
        const reader = new FileReader();
        reader.readAsDataURL(avatarFile);

        reader.onload = async () => {
          const base64 = reader.result as string;
          variables.input.avatarBase64 = base64;

          await updateUser({ variables });
          // window.location.reload(); // Refresh the page to reflect changes
        };
      } else {
        await updateUser({ variables });
        // window.location.reload();
      }
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const handlePasswordUpdate = async () => {
    setPasswordError("");

    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("Both password fields are required");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    try {
      await updateUser({
        variables: {
          input: {
            id: userId || "",
            password: passwordData.newPassword,
          },
        },
      });

      // Reset form and close modal on success
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setIsPasswordModalOpen(false);

      // Show success message (you can implement a toast notification here)
      alert("Password updated successfully");
    } catch (error) {
      console.error("Error updating password:", error);
      if (error instanceof Error) {
        setPasswordError(error.message || "Failed to update password");
      } else {
        setPasswordError("Failed to update password");
      }
    }
  };

  const handleLogout = () => {
    // Clear cookies and redirect
    deleteCookie("token");
    deleteCookie("user");
    router.push("/pages/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Error loading profile
          </h2>
          <p className="text-gray-700">{error.message}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Access the user data correctly through data.user
  const user = data?.user;
  const isGoogleUser = !!user?.googleId;
  const displayAvatar = avatarPreview || user?.avatar;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-indigo-600 h-32"></div>
          <div className="px-6 pb-6 relative">
            <div className="flex justify-between items-start">
              <div className="flex items-end -mt-11">
                <div className="relative">
                  <div
                    className={`w-32 h-32 rounded-full border-4 border-white overflow-hidden ${
                      isEditing ? "cursor-pointer" : ""
                    }`}
                    onClick={handleAvatarClick}
                  >
                    {displayAvatar ? (
                      <img
                        src={displayAvatar}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-indigo-100 flex items-center justify-center">
                        <FaUser className="w-16 h-16 text-indigo-600" />
                      </div>
                    )}
                  </div>

                  {/* Hidden file input for avatar upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {isEditing && (
                    <button
                      className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full"
                      onClick={handleAvatarClick}
                    >
                      <FaCamera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="ml-6 mb-4">
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="text-2xl font-bold bg-indigo-50 px-3 py-1 rounded"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-gray-800">
                      {user?.firstName || "User"} {user?.lastName || ""}
                    </h1>
                  )}
                  <p className="text-gray-600">
                    @{user?.googleId ? "google-user" : "user"}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setAvatarPreview(null);
                        setAvatarFile(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      disabled={updating}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                      disabled={updating}
                    >
                      {updating ? (
                        <span className="flex items-center">
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Saving...
                        </span>
                      ) : (
                        <>
                          <FaCheckCircle className="mr-2" /> Save
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                  >
                    <FaEdit className="mr-2" /> Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rest of the component remains the same... */}
        {/* Profile Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <FaUser className="mr-2 text-indigo-600" /> Personal Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                ) : (
                  <p className="text-gray-800">
                    {user?.firstName || "Not provided"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                ) : (
                  <p className="text-gray-800">
                    {user?.lastName || "Not provided"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Email
                </label>
                <div className="flex items-center">
                  <div className="flex items-center text-gray-800">
                    <FaEnvelope className="mr-2 text-indigo-600" />{" "}
                    {user?.email || "Not provided"}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Status
                </label>
                <div className="flex items-center text-gray-800">
                  {user?.isEmailVerified ? (
                    <span className="text-green-500 flex items-center">
                      <FaCheckCircle className="mr-1" /> Verified
                    </span>
                  ) : (
                    <span className="text-yellow-500">Not Verified</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bio & Security */}
          <div className="space-y-6">
            {/* Display update error if any */}
            {updateError && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                {updateError.message}
              </div>
            )}

            {/* Bio */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">About</h2>
              {isEditing ? (
                <textarea
                  name="about"
                  value={formData.about}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 h-32"
                  placeholder="Tell us about yourself..."
                ></textarea>
              ) : (
                <p className="text-gray-700">{formData.about || ""}</p>
              )}
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FaLock className="mr-2 text-indigo-600" /> Security
              </h2>
              <div className="space-y-3">
                {isGoogleUser ? (
                  <div className="group relative">
                    <button
                      disabled
                      className="w-full text-left px-4 py-3 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed flex items-center"
                    >
                      <FaLock className="mr-2" /> Change Password
                    </button>
                    <div className="absolute left-0 bottom-full mb-2 w-64 bg-gray-800 text-white p-2 rounded text-sm invisible group-hover:visible">
                      Google users cannot change their password. Please use
                      Google to manage your account security.
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center"
                  >
                    <FaLock className="mr-2" /> Change Password
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center"
                >
                  <FaSignOutAlt className="mr-2" /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Change Password
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>

            {passwordError && (
              <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordUpdate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
              >
                <FaLock className="mr-2" /> Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
