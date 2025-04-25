export interface UpdateUserInput {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  about?: string;
}

export interface UpdateUserResponse {
  updateUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password?: string
    about?: string;
    googleId?: string;
    
    isEmailVerified: boolean;
    avatar?: string;
  }
}