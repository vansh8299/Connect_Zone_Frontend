// WebRTC configuration
const RTCConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }, // Add more STUN servers
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isInitialized: boolean = false;
  private isCreatingOffer: boolean = false;
  private isCreatingAnswer: boolean = false;
  private cleanupInProgress: boolean = false;

  // Event callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onIceCandidateCallback:
    | ((candidate: RTCIceCandidate) => void)
    | null = null;
  private onConnectionStateChangeCallback:
    | ((state: RTCPeerConnectionState) => void)
    | null = null;

  constructor() {
    // Don't initialize in constructor, wait for explicit initialization
  }

  private initializePeerConnection(): RTCPeerConnection {
    // Always clean up existing connection first
    if (this.peerConnection && !this.cleanupInProgress) {
      console.log(
        "Cleaning up existing peer connection before creating new one"
      );
      this.cleanup();
    }

    console.log("Creating new RTCPeerConnection");
    const peerConnection = new RTCPeerConnection(RTCConfig);
    this.peerConnection = peerConnection;

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log("Remote track received:", event);
      const stream = event.streams[0];
      if (stream && !this.cleanupInProgress) {
        this.remoteStream = stream;
        this.onRemoteStreamCallback?.(stream);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && !this.cleanupInProgress) {
        console.log("ICE candidate generated:", event.candidate.candidate);
        this.onIceCandidateCallback?.(event.candidate);
      } else if (!event.candidate) {
        console.log("ICE candidate gathering completed");
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (!this.cleanupInProgress) {
        console.log(
          "Connection state changed:",
          peerConnection.connectionState
        );
        this.onConnectionStateChangeCallback?.(peerConnection.connectionState);

        // Reset flags when connection is closed or failed
        if (
          peerConnection.connectionState === "closed" ||
          peerConnection.connectionState === "failed"
        ) {
          this.resetFlags();
        }
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      if (!this.cleanupInProgress) {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
      }
    };

    // Handle signaling state changes
    peerConnection.onsignalingstatechange = () => {
      if (!this.cleanupInProgress) {
        console.log("Signaling state:", peerConnection.signalingState);

        // Reset flags when back to stable
        if (peerConnection.signalingState === "stable") {
          this.isCreatingOffer = false;
          this.isCreatingAnswer = false;
        }
      }
    };

    return peerConnection;
  }

  private resetFlags() {
    this.isCreatingOffer = false;
    this.isCreatingAnswer = false;
  }

  // Initialize media stream and peer connection
  async initializeLocalStream(): Promise<MediaStream> {
    try {
      console.log("Initializing local stream...");

      // Clean up any existing local stream first
      if (this.localStream) {
        console.log("Cleaning up existing local stream");
        this.cleanupStream(this.localStream);
        this.localStream = null;
      }

      // Always create a fresh peer connection
      this.initializePeerConnection();

      // Get media stream with optimized constraints
      console.log("Requesting user media...");
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log(
        "Local stream obtained:",
        this.localStream.getTracks().length,
        "tracks"
      );

      // Add tracks to peer connection
      if (this.peerConnection && this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          if (this.peerConnection && this.localStream) {
            console.log(`Adding ${track.kind} track to peer connection`);
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      this.isInitialized = true;
      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      this.isInitialized = false;
      this.resetFlags();
      throw error;
    }
  }

  // Create offer for initiating a call
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    try {
      console.log("Creating offer...");

      // Check if we're already creating an offer
      if (this.isCreatingOffer) {
        throw new Error("Offer creation already in progress");
      }

      // Ensure we have a fresh connection
      if (!this.isInitialized || !this.peerConnection) {
        console.log("Reinitializing before creating offer");
        await this.initializeLocalStream();
      }

      if (!this.peerConnection) {
        throw new Error("Peer connection not initialized");
      }

      // Check signaling state
      const signalingState = this.peerConnection.signalingState;
      console.log(
        "Current signaling state before creating offer:",
        signalingState
      );

      // If not in stable state, clean up and reinitialize
      if (signalingState !== "stable") {
        console.log("Signaling state not stable, reinitializing connection");
        await this.initializeLocalStream(); // This will cleanup and create fresh connection

        if (!this.peerConnection) {
          throw new Error("Failed to reinitialize peer connection");
        }
      }

      // Set flag to prevent concurrent offers
      this.isCreatingOffer = true;

      // Create offer with specific options
      const offerOptions: RTCOfferOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      };

      console.log("Creating offer with options:", offerOptions);
      const offer = await this.peerConnection.createOffer(offerOptions);

      if (!offer || !offer.sdp) {
        throw new Error("Invalid offer created");
      }

      console.log("Offer created, setting local description");
      await this.peerConnection.setLocalDescription(offer);

      console.log(
        "Local description set, signaling state:",
        this.peerConnection.signalingState
      );

      // Wait for ICE gathering with shorter timeout
      await this.waitForIceGatheringCompleteWithTimeout(3000);

      // Return the final local description
      const finalOffer = this.peerConnection.localDescription;
      if (!finalOffer) {
        throw new Error("Failed to get local description after setting offer");
      }

      console.log("Offer creation completed successfully");
      return {
        type: finalOffer.type,
        sdp: finalOffer.sdp,
      };
    } catch (error) {
      console.error("Error creating offer:", error);
      this.resetFlags();
      throw error;
    }
  }

  private async waitForIceGatheringCompleteWithTimeout(
    timeoutMs: number
  ): Promise<void> {
    if (!this.peerConnection) return;

    const peerConnection = this.peerConnection;

    if (peerConnection.iceGatheringState === "complete") {
      console.log("ICE gathering already complete");
      return;
    }

    console.log(
      `Waiting for ICE gathering to complete (timeout: ${timeoutMs}ms)...`
    );

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log("ICE gathering timeout reached, proceeding anyway");
        peerConnection.removeEventListener(
          "icegatheringstatechange",
          checkState
        );
        resolve();
      }, timeoutMs);

      const checkState = () => {
        console.log(
          "ICE gathering state changed:",
          peerConnection.iceGatheringState
        );
        if (peerConnection.iceGatheringState === "complete") {
          clearTimeout(timeout);
          peerConnection.removeEventListener(
            "icegatheringstatechange",
            checkState
          );
          console.log("ICE gathering completed");
          resolve();
        }
      };

      peerConnection.addEventListener("icegatheringstatechange", checkState);
    });
  }

  // Handle incoming call
  async handleIncomingCall(
    sdpOffer: string
  ): Promise<RTCSessionDescriptionInit> {
    try {
      console.log("Handling incoming call...");

      // Check if we're already creating an answer
      if (this.isCreatingAnswer) {
        throw new Error("Answer creation already in progress");
      }

      // Ensure we have a fresh connection
      if (!this.isInitialized || !this.peerConnection) {
        console.log("Initializing for incoming call");
        await this.initializeLocalStream();
      }

      if (!this.peerConnection) {
        throw new Error("Peer connection not initialized");
      }

      // Set flag to prevent concurrent operations
      this.isCreatingAnswer = true;

      // Parse and validate the offer
      let parsedOffer;
      try {
        parsedOffer = JSON.parse(sdpOffer);
      } catch (parseError) {
        throw new Error("Invalid SDP offer format");
      }

      if (!parsedOffer || !parsedOffer.sdp || !parsedOffer.type) {
        throw new Error("Invalid SDP offer content");
      }

      console.log("Setting remote description for incoming call");
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(parsedOffer)
      );

      console.log("Remote description set, creating answer");
      const answer = await this.peerConnection.createAnswer();

      if (!answer || !answer.sdp) {
        throw new Error("Failed to create answer");
      }

      console.log("Answer created, setting local description");
      await this.peerConnection.setLocalDescription(answer);

      // Wait for ICE gathering with shorter timeout
      await this.waitForIceGatheringCompleteWithTimeout(3000);

      // Return the final local description
      const finalAnswer = this.peerConnection.localDescription;
      if (!finalAnswer) {
        throw new Error(
          "Failed to get local description after creating answer"
        );
      }

      console.log("Answer creation completed successfully");
      return {
        type: finalAnswer.type,
        sdp: finalAnswer.sdp,
      };
    } catch (error) {
      console.error("Error handling incoming call:", error);
      this.resetFlags();
      throw error;
    }
  }

  // Handle call answer
  async handleCallAnswered(sdpAnswer: string): Promise<void> {
    try {
      const peerConnection = this.peerConnection;
      if (!peerConnection) {
        throw new Error("Peer connection not initialized");
      }

      // Parse and validate the answer
      let parsedAnswer;
      try {
        parsedAnswer = JSON.parse(sdpAnswer);
      } catch (parseError) {
        throw new Error("Invalid SDP answer format");
      }

      if (!parsedAnswer || !parsedAnswer.sdp || !parsedAnswer.type) {
        throw new Error("Invalid SDP answer content");
      }

      console.log("Setting remote description for call answer");
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(parsedAnswer)
      );
      console.log("Remote description set successfully");
    } catch (error) {
      console.error("Error handling call answer:", error);
      throw error;
    }
  }

  // Handle ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection || this.cleanupInProgress) {
      console.warn("Cannot add ICE candidate: peer connection not available");
      return;
    }

    try {
      // Validate candidate
      if (!candidate || typeof candidate.candidate !== "string") {
        console.warn("Invalid ICE candidate received, skipping");
        return;
      }

      // Check if remote description is set
      if (!this.peerConnection.remoteDescription) {
        console.warn("Remote description not set yet, skipping ICE candidate");
        return;
      }

      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("ICE candidate added successfully");
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
      // Don't rethrow - ICE candidate failures shouldn't break the call
    }
  }

  // Toggle screen share
  async toggleScreenShare(): Promise<boolean> {
    try {
      if (!this.peerConnection) {
        throw new Error("No active call");
      }

      // Get current video senders
      const videoSender = this.peerConnection
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      if (!videoSender) {
        throw new Error("No video sender found");
      }

      // If current track is from screen share, switch back to camera
      if (videoSender.track?.label.includes("screen")) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
        return false;
      }

      // Otherwise, switch to screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 15, max: 30 },
        },
      });

      await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);

      // Handle screen share stop
      screenStream.getVideoTracks()[0].onended = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
          });
          if (videoSender.track) {
            await videoSender.replaceTrack(stream.getVideoTracks()[0]);
          }
        } catch (error) {
          console.error("Error switching back to camera:", error);
        }
      };

      return true;
    } catch (error) {
      console.error("Error toggling screen share:", error);
      throw error;
    }
  }

  // Event listeners
  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChangeCallback = callback;
  }

  // Get current connection state
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private cleanupStream(stream: MediaStream | null) {
    if (!stream) return;

    console.log("Cleaning up stream with", stream.getTracks().length, "tracks");
    const tracks = stream.getTracks();

    tracks.forEach((track) => {
      try {
        if (track.readyState === "live") {
          track.stop();
          console.log(`Stopped ${track.kind} track: ${track.label}`);
        }
      } catch (error) {
        console.error(`Error stopping ${track.kind} track:`, error);
      }
    });
  }

  // Clean up
  cleanup() {
    if (this.cleanupInProgress) {
      console.log("Cleanup already in progress, skipping");
      return;
    }

    try {
      console.log("Starting WebRTC service cleanup...");
      this.cleanupInProgress = true;

      // Reset flags first
      this.resetFlags();

      // Close peer connection first to prevent any new events
      if (this.peerConnection) {
        console.log(
          "Closing peer connection, current state:",
          this.peerConnection.connectionState
        );

        // Remove all event listeners to prevent callbacks during cleanup
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onsignalingstatechange = null;

        // Close the connection if it's not already closed
        if (this.peerConnection.connectionState !== "closed") {
          this.peerConnection.close();
        }
        this.peerConnection = null;
      }

      // Clean up streams after closing peer connection
      this.cleanupStream(this.localStream);
      this.cleanupStream(this.remoteStream);

      // Clear stream references
      this.localStream = null;
      this.remoteStream = null;

      // Reset callbacks
      this.onRemoteStreamCallback = null;
      this.onIceCandidateCallback = null;
      this.onConnectionStateChangeCallback = null;

      // Reset initialization flag
      this.isInitialized = false;

      console.log("WebRTC service cleanup completed successfully");
    } catch (error) {
      console.error("Error during WebRTC cleanup:", error);
    } finally {
      this.cleanupInProgress = false;
    }
  }
}

export default WebRTCService;
