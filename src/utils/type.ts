export interface UpdateUserInput {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  avatarBase64?: string; // Add this for base64 encoded images
  about?: string;
}
export interface UpdateUserResponse {
  updateUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password?: string;
    about?: string;
    googleId?: string;

    isEmailVerified: boolean;
    avatar?: string;
  };
}
export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  avatarBase64?: string;
}
