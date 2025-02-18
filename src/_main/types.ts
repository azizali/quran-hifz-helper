type Brand<K, T> = K & { __brand: T };
export type Track = Brand<string, "Track">;

export type TrackObject = {
  surahNumber: number;
  ayatNumber: number;
  track: Track;
  trackUrl: string;
};

export type SURAH = {
  number: number; // TODO type so that its 1 to 114
  name: string;
  nameEnglish: string;
  numberOfAyats: number; // TODO type so that its 3 to 200
};
