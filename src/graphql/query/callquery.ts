import { gql } from "@apollo/client";

export const GET_CALL_HISTORY = gql`
  query GetCallHistory {
    getCallHistory {
      id
      caller {
        id
        firstName
        lastName
        avatar
      }
      receiver {
        id
        firstName
        lastName
        avatar
      }
      status
      startedAt
      endedAt
      duration
    }
  }
`;

export const CALL_INITIATED_SUBSCRIPTION = gql`
  subscription OnCallInitiated {
    callInitiated {
      call {
        id
        caller {
          id
          firstName
          lastName
          avatar
        }
        receiver {
          id
          firstName
          lastName
          avatar
        }
        status
        startedAt
      }
    }
  }
`;
export const SEARCH_USERS = gql`
  query SearchUsers($searchTerm: String!) {
    searchUsers(searchTerm: $searchTerm) {
      id
      firstName
      lastName
      avatar
    }
  }
`;


export const GET_CALL = gql`
  query GetCall($id: ID!) {
    getCall(id: $id) {
      id
      caller {
        id
        firstName
        lastName
        avatar
      }
      receiver {
        id
        firstName
        lastName
        avatar
      }
      status
      startedAt
    }
  }
`;

export const ANSWER_CALL = gql`
  mutation AnswerCall($input: AnswerCallInput!) {
    answerCall(input: $input) {
      call {
        id
        status
      }
    }
  }
`;

export const END_CALL = gql`
  mutation EndCall($input: EndCallInput!) {
    endCall(input: $input) {
      id
      status
    }
  }
`;

export const ADD_ICE_CANDIDATE = gql`
  mutation AddIceCandidate($input: IceCandidateInput!) {
    addIceCandidate(input: $input)
  }
`;

export const CALL_ANSWERED_SUBSCRIPTION = gql`
  subscription OnCallAnswered {
    callAnswered {
      call {
        id
        status
      }
    }
  }
`;

export const CALL_ENDED_SUBSCRIPTION = gql`
  subscription OnCallEnded {
    callEnded {
      id
      status
    }
  }
`;

export const ICE_CANDIDATE_SUBSCRIPTION = gql`
  subscription OnIceCandidateReceived {
    iceCandidateReceived {
      callId
      candidate
    }
  }
`;