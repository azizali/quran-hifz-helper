type Brand<K, T> = K & { __brand: T };
export type Track = Brand<string, "Track">;

export type TrackObject = {
  surahNumber: number;
  ayatNumber: number;
  track: Track;
  trackUrl: string;
};
