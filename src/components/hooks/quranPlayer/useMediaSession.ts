import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react";
import type { TrackUrl } from "../../../_main/types";
import type { TrackOffset } from "./types";

type UseMediaSessionParams = {
  surahName: string;
  ayatRange: [number, number];
  artistName: string;
  audioPlayerRef: RefObject<HTMLAudioElement | null>;
  intentToPlayRef: MutableRefObject<boolean>;
  activeTrackUrlRef: MutableRefObject<TrackUrl>;
  trackOffsetsRef: MutableRefObject<TrackOffset[]>;
  startPlaybackRef: MutableRefObject<() => void>;
  seekToTrackRef: MutableRefObject<(trackUrl: TrackUrl) => void>;
  setIsPlaying: (isPlaying: boolean) => void;
};

export function useMediaSession({
  surahName,
  ayatRange,
  artistName,
  audioPlayerRef,
  intentToPlayRef,
  activeTrackUrlRef,
  trackOffsetsRef,
  startPlaybackRef,
  seekToTrackRef,
  setIsPlaying,
}: UseMediaSessionParams) {
  const setPlaybackState = useCallback((state: MediaSessionPlaybackState) => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }, []);

  const updateMediaSessionMetadata = useCallback(() => {
    if (!("mediaSession" in navigator)) return;

    const [startAyat, endAyat] = ayatRange;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${surahName} - Ayat ${startAyat}-${endAyat}`,
      album: surahName,
      artist: artistName,
    });
  }, [surahName, ayatRange, artistName]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      startPlaybackRef.current();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      intentToPlayRef.current = false;
      audioPlayerRef.current?.pause();
      setIsPlaying(false);
      setPlaybackState("paused");
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const offsets = trackOffsetsRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const index = offsets.findIndex((offset) => offset.trackUrl === currentUrl);

      if (index >= 0 && index < offsets.length - 1) {
        seekToTrackRef.current(offsets[index + 1].trackUrl);
      }
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const offsets = trackOffsetsRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const index = offsets.findIndex((offset) => offset.trackUrl === currentUrl);

      if (index > 0) {
        seekToTrackRef.current(offsets[index - 1].trackUrl);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, [
    audioPlayerRef,
    intentToPlayRef,
    activeTrackUrlRef,
    trackOffsetsRef,
    startPlaybackRef,
    seekToTrackRef,
    setIsPlaying,
    setPlaybackState,
  ]);

  return {
    setPlaybackState,
    updateMediaSessionMetadata,
  };
}
