/**
 * Audio session management — ensures the browser/OS audio session stays alive.
 *
 * A near-silent oscillator (gain ≈ 0.001, inaudible) runs continuously while
 * playback is active.  This keeps the AudioContext — and therefore the OS-level
 * audio session — marked as "producing audio", so mobile browsers won't suspend
 * the page.
 *
 * The manager also handles AudioContext state changes (e.g. the OS suspending
 * it when the page goes to background) and automatically resumes it.
 */
export class AudioSessionManager {
  private static instance: AudioSessionManager;
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private keepaliveRunning = false;
  private stateChangeHandler: (() => void) | null = null;

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

          // Auto-resume AudioContext when the OS unsuspends it
          this.stateChangeHandler = () => {
            const state = this.audioContext?.state as string | undefined;
            if (state === "interrupted" || state === "suspended") {
              this.audioContext!.resume().catch(() => {});
            }
          };
          this.audioContext.addEventListener(
            "statechange",
            this.stateChangeHandler
          );
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
    if (this.audioContext) {
      if (
        this.audioContext.state === "suspended" ||
        (this.audioContext.state as string) === "interrupted"
      ) {
        await this.audioContext.resume();
      }
    }
  }
}

export default AudioSessionManager;
