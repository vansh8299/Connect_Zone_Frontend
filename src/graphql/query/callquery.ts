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

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    currentUser {
      id
      firstName
      lastName
      email
      avatar
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

// FIXED: Added callId parameter to subscriptions that require it
export const CALL_ANSWERED_SUBSCRIPTION = gql`
  subscription OnCallAnswered($callId: ID!) {
    callAnswered(callId: $callId) {
      call {
        id
        status
      }
    }
  }
`;

export const CALL_ENDED_SUBSCRIPTION = gql`
  subscription OnCallEnded($callId: ID!) {
    callEnded(callId: $callId) {
      id
      status
    }
  }
`;
// Add this mutation to properly exchange SDP offers
export const SEND_SDP_OFFER = gql`
  mutation SendSdpOffer($input: SendSdpOfferInput!) {
    sendSdpOffer(input: $input) {
      success
      call {
        id
        status
      }
    }
  }
`;

export const START_CALL = gql`
  mutation StartCall($input: StartCallInput!) {
    startCall(input: $input) {
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
      sdpOffer
    }
  }
`;
export const ICE_CANDIDATE_SUBSCRIPTION = gql`
  subscription OnIceCandidateReceived($callId: ID!) {
    iceCandidateReceived(callId: $callId) {
      callId
      candidate
    }
  }
`;