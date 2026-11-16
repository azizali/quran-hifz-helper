import type { TrackObject, TrackUrl } from "../_main/types";
import qaris, { type QariKey } from "./controls/qari";

const audioExtention = "mp3"; // 'opus' | 'mp3'
const audioSrcBaseUrl = `https://everyayah.com/data`;

export const getTracksToPlay = (
  ayatRange: [number, number],
  surahNumber: number,
  qariKey: QariKey
): TrackObject[] => {
  const [startingAyatNumber, endingAyatNumber] = ayatRange;
  let ayatNumber = startingAyatNumber - 1;

  const trackObjects: TrackObject[] = Array.from({
    length: endingAyatNumber - ayatNumber,
  }).map(() => {
    ayatNumber++;

    const track = `${surahNumber.toString().padStart(3, "0")}${ayatNumber
      .toString()
      .padStart(3, "0")}`;

    const qariUrlPath = qaris[qariKey].urlPath;
    const trackUrl: TrackUrl =
      `${audioSrcBaseUrl}/${qariUrlPath}/${track}.${audioExtention}` as TrackUrl;

    return {
      surahNumber,
      ayatNumber,
      trackUrl,
    };
  });

  return trackObjects;
};

/**
 * Bring the playing ayah's row into the ayat list's view. Rows already fully
 * visible stay put; otherwise the row is centred, or, when it is too tall to
 * centre, its first line is placed at the top so reading starts there.
 */
export const scrollTrackIntoView = (trackUrl: string) => {
  const escaped =
    window.CSS && typeof window.CSS.escape === "function"
      ? window.CSS.escape(trackUrl)
      : trackUrl.replace(/"/g, '\\"');
  const row = document.querySelector<HTMLElement>(`[data-track-url="${escaped}"]`);
  const list = row?.closest<HTMLElement>("[data-ayat-list]");
  if (!row || !list) return;

  const listBox = list.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  const margin = 8;
  if (rowBox.top >= listBox.top + margin && rowBox.bottom <= listBox.bottom - margin) return;

  const rowTop = list.scrollTop + (rowBox.top - listBox.top);
  const fitsCentred = rowBox.height < listBox.height * 0.6;
  const top = fitsCentred ? rowTop - (listBox.height - rowBox.height) / 2 : rowTop - margin;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  list.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
};

export const getActiveAyatNumber = (activeTrackUrl: TrackUrl): number => {
  const lengthOfAudioExtentionPlusDot = audioExtention.length + 1;
  const lengthOfTrackNumber = 6;
  const track = activeTrackUrl.slice(
    activeTrackUrl.length - lengthOfAudioExtentionPlusDot - lengthOfTrackNumber,
    activeTrackUrl.length - lengthOfAudioExtentionPlusDot
  );
  return parseInt(track.split("").slice(3).join("")) | 0;
};
