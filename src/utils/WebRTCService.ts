// WebRTC configuration
const RTCConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

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
    // Clean up existing connection if any
    this.cleanup();

    // Create new peer connection
    const peerConnection = new RTCPeerConnection(RTCConfig);
    this.peerConnection = peerConnection;

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        this.remoteStream = stream;
        this.onRemoteStreamCallback?.(stream);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidateCallback?.(event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      this.onConnectionStateChangeCallback?.(peerConnection.connectionState);
    };

    return peerConnection;
  }

  // Initialize media stream and peer connection
  async initializeLocalStream(): Promise<MediaStream> {
    try {
      // Initialize peer connection first
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      // Get media stream with optimized constraints
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { max: 640 },
          height: { max: 480 },
          frameRate: { max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Add tracks to peer connection
      if (this.peerConnection && this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }

  private async waitForIceGatheringComplete(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection');
    }

    const peerConnection = this.peerConnection;

    if (peerConnection.iceGatheringState === 'complete') {
      return;
    }

    return new Promise<void>((resolve) => {
      const checkState = () => {
        if (peerConnection.iceGatheringState === 'complete') {
          peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      peerConnection.addEventListener('icegatheringstatechange', checkState);
    });
  }

  // Create offer for initiating a call
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    try {
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      if (!this.localStream) {
        await this.initializeLocalStream();
      }

      // Create offer with specific options
      const offerOptions: RTCOfferOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      };
      
      const offer = await this.peerConnection!.createOffer(offerOptions);
      
      // Set local description
      await this.peerConnection!.setLocalDescription(offer);

      // Return the offer directly
      return offer;
    } catch (error) {
      console.error("Error creating offer:", error);
      throw error;
    }
  }

  // Toggle screen share
  async toggleScreenShare(): Promise<boolean> {
    try {
      if (!this.peerConnection) {
        await this.initializeLocalStream(); // This will also initialize peer connection
      }

      // Get current video senders
      const videoSender = this.peerConnection!.getSenders().find(
        (sender) => sender.track?.kind === "video"
      );

      if (!videoSender) {
        throw new Error("No video sender found");
      }

      // If current track is from screen share, switch back to camera
      if (videoSender.track?.label.includes("screen")) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { max: 640 },
            height: { max: 480 },
            frameRate: { max: 30 },
          },
        });
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
        return false;
      }

      // Otherwise, switch to screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 15 },
        },
      });
      await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);

      // Handle screen share stop
      screenStream.getVideoTracks()[0].onended = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { max: 640 },
            height: { max: 480 },
            frameRate: { max: 30 },
          },
        });
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
      };

      return true;
    } catch (error) {
      console.error("Error toggling screen share:", error);
      throw error;
    }
  }

  // Handle incoming call
  async handleIncomingCall(
    sdpOffer: string
  ): Promise<RTCSessionDescriptionInit> {
    try {
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      if (!this.localStream) {
        await this.initializeLocalStream();
      }

      // Parse and set remote description
      const parsedOffer = JSON.parse(sdpOffer);
      await this.peerConnection!.setRemoteDescription(parsedOffer);

      // Create answer
      const answer = await this.peerConnection!.createAnswer();
      
      // Set local description
      await this.peerConnection!.setLocalDescription(answer);

      // Return the answer directly
      return answer;
    } catch (error) {
      console.error("Error handling incoming call:", error);
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

      const parsedAnswer = JSON.parse(sdpAnswer);
      await peerConnection.setRemoteDescription(parsedAnswer);
    } catch (error) {
      console.error("Error handling call answer:", error);
      throw error;
    }
  }

  // Handle ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
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
    const tracks = stream.getTracks();
    
    tracks.forEach(track => {
      try {
        if (track.readyState === 'live') {
          track.stop();
          // Only log if actually stopping a track
          console.log(`Stopping ${track.kind} track: ${track.label}`);
        }
      } catch (error) {
        console.error(`Error stopping ${track.kind} track:`, error);
      }
    });
  }

  // Clean up
  cleanup() {
    try {
      // Stop peer connection first to prevent any new track events
      if (this.peerConnection) {
        // Remove all event listeners
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        
        // Close the connection
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Clean up streams
      this.cleanupStream(this.localStream);
      this.cleanupStream(this.remoteStream);

      // Clear stream references
      this.localStream = null;
      this.remoteStream = null;

      // Reset callbacks
      this.onRemoteStreamCallback = null;
      this.onIceCandidateCallback = null;
      this.onConnectionStateChangeCallback = null;
    } catch (error) {
      console.error('Error during WebRTC cleanup:', error);
    }
  }
}

export default WebRTCService;
