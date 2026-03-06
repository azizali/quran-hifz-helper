import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { TrackUrl } from "../../../_main/types";
import type { TrackOffset } from "./types";

type UseAudioElementEventsParams = {
  audioPlayerRef: RefObject<HTMLAudioElement | null>;
  intentToPlayRef: MutableRefObject<boolean>;
  shouldRepeatRef: MutableRefObject<boolean>;
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
  shouldRepeatRef,
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

    const onEnded = () => {
      if (shouldRepeatRef.current) {
        audioElement.currentTime = 0;
        const firstTrack = trackOffsetsRef.current[0];
        if (firstTrack) {
          setActiveTrackUrl(firstTrack.trackUrl);
          activeTrackUrlRef.current = firstTrack.trackUrl;
        }
        audioElement.play().catch(console.error);
        return;
      }

      intentToPlayRef.current = false;
      setIsPlaying(false);
      onPlaybackStopped();
    };

    const onPause = () => {
      if (!intentToPlayRef.current) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => setIsPlaying(true);

    audioElement.addEventListener("timeupdate", onTimeUpdate);
    audioElement.addEventListener("ended", onEnded);
    audioElement.addEventListener("pause", onPause);
    audioElement.addEventListener("play", onPlay);

    return () => {
      audioElement.removeEventListener("timeupdate", onTimeUpdate);
      audioElement.removeEventListener("ended", onEnded);
      audioElement.removeEventListener("pause", onPause);
      audioElement.removeEventListener("play", onPlay);
    };
  }, [
    audioPlayerRef,
    intentToPlayRef,
    shouldRepeatRef,
    trackOffsetsRef,
    activeTrackUrlRef,
    setActiveTrackUrl,
    setIsPlaying,
    onTrackChanged,
    onPlaybackStopped,
  ]);
}
