type Brand<K, T> = K & { __brand: T };
export type Track = Brand<string, "Track">;

export type TrackObject = {
  surahNumber: number;
  ayatNumber: number;
  track: Track;
  trackUrl: string;
};

export type Mufhas = "15-line-simple" | "15-line-green" | "uthmani";
