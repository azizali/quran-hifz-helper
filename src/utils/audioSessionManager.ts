// Audio session management — ensures AudioContext stays active for background playback
export class AudioSessionManager {
  private static instance: AudioSessionManager;
  private audioContext: AudioContext | null = null;

  static getInstance(): AudioSessionManager {
    if (!AudioSessionManager.instance) {
      AudioSessionManager.instance = new AudioSessionManager();
    }
    return AudioSessionManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Create or resume AudioContext — this signals to the OS that
      // the page is producing audio and should keep running in the background.
      if ("AudioContext" in window || "webkitAudioContext" in window) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;

        if (!this.audioContext) {
          this.audioContext = new AudioContextClass();
        }

        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }
      }
    } catch (error) {
      console.error("Failed to initialize audio session:", error);
    }
  }

  async ensureAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }
}

export default AudioSessionManager;
