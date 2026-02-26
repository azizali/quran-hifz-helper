/**
 * Audio session management — ensures the browser/OS audio session stays alive
 * even during the tiny gap between playlist tracks.
 *
 * A near-silent oscillator (gain ≈ 0.001, inaudible) runs continuously while
 * playback is active.  This keeps the AudioContext — and therefore the OS-level
 * audio session — marked as "producing audio", so mobile browsers won't suspend
 * the page when one <audio> element ends and before the next one starts.
 */
export class AudioSessionManager {
  private static instance: AudioSessionManager;
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private keepaliveRunning = false;

  static getInstance(): AudioSessionManager {
    if (!AudioSessionManager.instance) {
      AudioSessionManager.instance = new AudioSessionManager();
    }
    return AudioSessionManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      if ("AudioContext" in window || "webkitAudioContext" in window) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;

        if (!this.audioContext) {
          this.audioContext = new Ctx();
        }

        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }
      }
    } catch (error) {
      console.error("Failed to initialize audio session:", error);
    }
  }

  /**
   * Start a near-silent oscillator that keeps the audio session alive.
   * Call this when the user presses Play.
   */
  startKeepalive(): void {
    if (this.keepaliveRunning || !this.audioContext) return;

    try {
      // Gain set extremely low — completely inaudible but enough to keep
      // the AudioContext (and therefore the OS audio session) active.
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.001; // −60 dB, effectively silent

      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.frequency.value = 1; // 1 Hz — below human hearing
      this.oscillator.type = "sine";
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      this.oscillator.start();

      this.keepaliveRunning = true;
    } catch (e) {
      console.error("Failed to start keepalive oscillator:", e);
    }
  }

  /**
   * Stop the keepalive oscillator.
   * Call this when the user pauses/stops playback.
   */
  stopKeepalive(): void {
    if (!this.keepaliveRunning) return;

    try {
      this.oscillator?.stop();
      this.oscillator?.disconnect();
      this.gainNode?.disconnect();
    } catch {
      // ignore — already stopped
    }

    this.oscillator = null;
    this.gainNode = null;
    this.keepaliveRunning = false;
  }

  async ensureAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }
}

export default AudioSessionManager;
