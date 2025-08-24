import { gql } from "@apollo/client";

// Mutation to start a call
export const START_CALL = gql`
  mutation StartCall($input: StartCallInput!) {
    startCall(input: $input) {
      call {
        id
        status
        caller {
          id
          firstName
          lastName
        }
        receiver {
          id
          firstName
          lastName
        }
      }
      sdpOffer
      iceCandidate
    }
  }
`;

// Subscription for incoming calls
export const CALL_INITIATED_SUBSCRIPTION = gql`
  subscription OnCallInitiated {
    callInitiated {
      call {
        id
        status
        caller {
          id
          firstName
          lastName
        }
        receiver {
          id
          firstName
          lastName
        }
      }
      sdpOffer
      iceCandidate
    }
  }
`;

// Subscription for call answers
export const CALL_ANSWERED_SUBSCRIPTION = gql`
  subscription OnCallAnswered($callId: ID!) {
    callAnswered(callId: $callId) {
      call {
        id
        status
      }
      sdpOffer
      iceCandidate
    }
  }
`;

// Subscription for ICE candidates
export const ICE_CANDIDATE_SUBSCRIPTION = gql`
  subscription OnIceCandidateReceived($callId: ID!) {
    iceCandidateReceived(callId: $callId) {
      callId
      candidate
    }
  }
`;

// Mutation to answer a call
export const ANSWER_CALL = gql`
  mutation AnswerCall($input: AnswerCallInput!) {
    answerCall(input: $input) {
      call {
        id
        status
      }
      sdpOffer
      iceCandidate
    }
  }
`;

// Add ICE candidate mutation
export const ADD_ICE_CANDIDATE = gql`
  mutation AddIceCandidate($input: IceCandidateInput!) {
    addIceCandidate(input: $input)
  }
`;
