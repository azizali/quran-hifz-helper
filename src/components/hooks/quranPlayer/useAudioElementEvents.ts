import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { TrackUrl } from "../../../_main/types";
import { REPEAT_FOREVER, type RepeatSettings } from "./repeatSettings";
import type { TrackOffset } from "./types";

/** Where playback is within the repeat plan; reset whenever playback is repositioned. */
export type RepeatProgress = {
  /** Index of the ayat being counted, -1 when unknown. */
  ayatIndex: number;
  /** Which play of that ayat this is, starting at 1. */
  ayatPlay: number;
  /** How many full passes of the range have finished. */
  rangePasses: number;
};

export const freshRepeatProgress = (): RepeatProgress => ({ ayatIndex: -1, ayatPlay: 1, rangePasses: 0 });

type UseAudioElementEventsParams = {
  audioPlayerRef: RefObject<HTMLAudioElement | null>;
  intentToPlayRef: MutableRefObject<boolean>;
  repeatRef: MutableRefObject<RepeatSettings>;
  repeatProgressRef: MutableRefObject<RepeatProgress>;
  trackOffsetsRef: MutableRefObject<TrackOffset[]>;
  activeTrackUrlRef: MutableRefObject<TrackUrl>;
  setActiveTrackUrl: (trackUrl: TrackUrl) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  onTrackChanged: () => void;
  onPlaybackStopped: () => void;
};

export function useAudioElementEvents({
  audioPlayerRef,
  intentToPlayRef,
  repeatRef,
  repeatProgressRef,
  trackOffsetsRef,
  activeTrackUrlRef,
  setActiveTrackUrl,
  setIsPlaying,
  onTrackChanged,
  onPlaybackStopped,
}: UseAudioElementEventsParams) {
  useEffect(() => {
    const audioElement = audioPlayerRef.current;
    if (!audioElement) return;

    const onTimeUpdate = () => {
      const currentTime = audioElement.currentTime;
      const offsets = trackOffsetsRef.current;

      for (let index = offsets.length - 1; index >= 0; index--) {
        if (currentTime >= offsets[index].startTime - 0.05) {
          const trackUrl = offsets[index].trackUrl;

          if (trackUrl !== activeTrackUrlRef.current) {
            activeTrackUrlRef.current = trackUrl;
            setActiveTrackUrl(trackUrl);
            onTrackChanged();
          }

          break;
        }
      }
    };

    // timeupdate fires too rarely (~4 Hz) to cut an ayat at its end, so while
    // playing we check every frame and jump back to repeat the ayat.
    let frame = 0;
    const checkAyatRepeat = () => {
      frame = requestAnimationFrame(checkAyatRepeat);
      const { each } = repeatRef.current;
      const progress = repeatProgressRef.current;
      const time = audioElement.currentTime;
      const offsets = trackOffsetsRef.current;
      const index = offsets.findIndex((o) => time >= o.startTime - 0.05 && time < o.endTime);
      if (index === -1) return;

      if (index !== progress.ayatIndex) {
        progress.ayatIndex = index;
        progress.ayatPlay = 1;
        return;
      }
      if (each > 1 && progress.ayatPlay < each && time >= offsets[index].endTime - 0.06) {
        progress.ayatPlay++;
        audioElement.currentTime = offsets[index].startTime;
      }
    };
    const startRepeatWatch = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(checkAyatRepeat);
    };
    const stopRepeatWatch = () => cancelAnimationFrame(frame);

    const onEnded = () => {
      stopRepeatWatch();
      const { whole } = repeatRef.current;
      const progress = repeatProgressRef.current;
      progress.rangePasses++;
      if (whole === REPEAT_FOREVER || progress.rangePasses < whole) {
        progress.ayatIndex = -1;
        progress.ayatPlay = 1;
        audioElement.currentTime = 0;
        const firstTrack = trackOffsetsRef.current[0];
        if (firstTrack) {
          setActiveTrackUrl(firstTrack.trackUrl);
          activeTrackUrlRef.current = firstTrack.trackUrl;
        }
        audioElement.play().catch(console.error);
        return;
      }

      repeatProgressRef.current = freshRepeatProgress();
      intentToPlayRef.current = false;
      setIsPlaying(false);
      onPlaybackStopped();
    };

    const onPause = () => {
      stopRepeatWatch();
      if (!intentToPlayRef.current) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      startRepeatWatch();
    };

    audioElement.addEventListener("timeupdate", onTimeUpdate);
    audioElement.addEventListener("ended", onEnded);
    audioElement.addEventListener("pause", onPause);
    audioElement.addEventListener("play", onPlay);

    if (!audioElement.paused) startRepeatWatch();

    return () => {
      stopRepeatWatch();
      audioElement.removeEventListener("timeupdate", onTimeUpdate);
      audioElement.removeEventListener("ended", onEnded);
      audioElement.removeEventListener("pause", onPause);
      audioElement.removeEventListener("play", onPlay);
    };
  }, [
    audioPlayerRef,
    intentToPlayRef,
    repeatRef,
    repeatProgressRef,
    trackOffsetsRef,
    activeTrackUrlRef,
    setActiveTrackUrl,
    setIsPlaying,
    onTrackChanged,
    onPlaybackStopped,
  ]);
}
