import { gql } from "@apollo/client";

export const SEND_OTP_MUTATION = gql`
  mutation SendOtp($input: SendOtpInput!) {
    sendOtp(input: $input) {
      success
      message
    }
  }
`;

export const VERIFY_OTP_MUTATION = gql`
  mutation VerifyOtp($input: VerifyOtpInput!) {
    verifyOtp(input: $input) {
      success
      message
    }
  }
`;

export const SIGNUP_MUTATION = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
        avatar
      }
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Signin($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
      }
    }
  }
`;
export const GOOGLE_AUTH_MUTATION = gql`
  mutation GoogleAuth($input: GoogleAuthInput!) {
    googleAuth(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
      }
      isNewUser
    }
  }
`;

export const GET_USER_BY_ID = gql`
  query GetUserById($id: ID!) {
    user(id: $id) {
      id
      firstName
      lastName
      email
      password
      googleId
      about
      avatar
      isEmailVerified
    }
  }
`;
export const GET_USER = gql`
  query GetUser {
    users {
      id
      firstName
      lastName
      email
      password
      googleId
      about
      avatar
      isEmailVerified
    }
  }
`;
export const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      firstName
      lastName
      email
      password
      about
      isEmailVerified
      avatar
    }
  }
`;
export const UPDATE_PASSWORD_MUTATION = gql`
  mutation UpdatePassword($input: UpdatePasswordInput!) {
    updatePassword(input: $input) {
      success
      message
    }
  }
`;
