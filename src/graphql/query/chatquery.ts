// src/graphql/operations/chat.ts
import { gql } from '@apollo/client';

export const GET_CONVERSATIONS = gql`
  query GetConversations {
    getConversations {
      id
      isGroup
      participants {
        user {
          id
          firstName
          lastName
          avatar
        }
      }
      messages {
        id
        content
        createdAt
      }
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!) {
    getMessages(conversationId: $conversationId) {
      id
      content
      sender {
        id
        firstName
        lastName
        avatar
      }
      readBy {
        id
        user {
          id
        }
      }
      createdAt
      type
    }
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      sender {
        id
        firstName
        lastName
        avatar
      }
      readBy {
        id
        user {
          id
        }
      }
      createdAt
      type
    }
  }
`;

export const CREATE_CONVERSATION = gql`
  mutation CreateConversation($participantIds: [ID!]!) {
    createConversation(participantIds: $participantIds) {
      id
      isGroup
      participants {
        user {
          id
          firstName
          lastName
          avatar
        }
      }
    }
  }
`;

export const MESSAGE_SENT_SUBSCRIPTION = gql`
  subscription MessageSent($conversationId: ID!) {
    messageSent(conversationId: $conversationId) {
      id
      content
      sender {
        id
        firstName
        lastName
        avatar
      }
      readBy {
        id
        user {
          id
        }
      }
      createdAt
      type
    }
  }
`;

export const NEW_MESSAGE_SUBSCRIPTION = gql`
  subscription NewMessage {
    newMessage {
      id
      content
      sender {
        id
        firstName
        lastName
        avatar
      }
      conversationId
      readBy {
        id
        user {
          id
        }
      }
      createdAt
      type
    }
  }
`;

export const GET_USER_BY_EMAIL = gql`
  query GetUserByEmail($email: String!) {
    userByEmail(email: $email) {
      id
      firstName
      lastName
      email
      about
      avatar
      isEmailVerified
    }
  }
`;

export const SEARCH_USERS = gql`
  query SearchUsers($searchTerm: String!) {
    searchUsers(searchTerm: $searchTerm) {
      id
      firstName
      lastName
      email
      avatar
    }
  }
`;