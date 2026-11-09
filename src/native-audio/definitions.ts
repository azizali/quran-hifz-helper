import type { PluginListenerHandle } from "@capacitor/core";

export type QueueTrack = {
  /** Stable identifier, e.g. the everyayah trackUrl string */
  id: string;
  /** Remote URL to stream from */
  url: string;
  /** Local file path to play from instead of url, when downloaded */
  localPath?: string;
  title: string;
  album: string;
  artist: string;
};

export type SetQueueOptions = {
  tracks: QueueTrack[];
  startIndex?: number;
  playbackRate?: number;
};

export type SeekOptions = {
  /** Index into the current queue */
  index: number;
  /** Seconds within that track, default 0 */
  positionSeconds?: number;
};

export type PlaybackRateOptions = {
  rate: number;
};

export type TrackChangedEvent = {
  index: number;
  trackId: string;
};

export type PositionUpdateEvent = {
  index: number;
  trackId: string;
  positionSeconds: number;
  durationSeconds: number;
};

export type PlaybackStateEvent = {
  isPlaying: boolean;
};

export type QueueEndedEvent = Record<string, never>;

export type PlaybackErrorEvent = {
  message: string;
};

export interface NativeQuranAudioPlugin {
  setQueue(options: SetQueueOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(options: SeekOptions): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setPlaybackRate(options: PlaybackRateOptions): Promise<void>;
  setRepeat(options: { enabled: boolean }): Promise<void>;
  getStatus(): Promise<PositionUpdateEvent & PlaybackStateEvent>;

  addListener(
    eventName: "trackChanged",
    listenerFunc: (event: TrackChangedEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "positionUpdate",
    listenerFunc: (event: PositionUpdateEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "playbackState",
    listenerFunc: (event: PlaybackStateEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "queueEnded",
    listenerFunc: (event: QueueEndedEvent) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: "playbackError",
    listenerFunc: (event: PlaybackErrorEvent) => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}
