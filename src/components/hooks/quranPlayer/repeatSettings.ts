import { useLocalStorage } from "usehooks-ts";
import type { TrackObject } from "../../../_main/types";

export const MAX_REPEAT = 20;
/** `whole` value meaning "loop the range until stopped". */
export const REPEAT_FOREVER = 0;

export type RepeatSettings = {
  /** Times each ayat plays in a row (1 = play once). */
  each: number;
  /** Times the whole range plays (1 = once, REPEAT_FOREVER = loop). */
  whole: number;
};

// Defaults suit plain listening: play everything once.
export const DEFAULT_REPEAT: RepeatSettings = { each: 1, whole: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useRepeatSettings() {
  const [each, setEach] = useLocalStorage<number>("repeatEach", DEFAULT_REPEAT.each);
  const [whole, setWhole] = useLocalStorage<number>("repeatWhole", DEFAULT_REPEAT.whole);

  const settings: RepeatSettings = {
    each: clamp(Math.round(each) || 1, 1, MAX_REPEAT),
    whole: clamp(Math.round(whole) || 0, REPEAT_FOREVER, MAX_REPEAT),
  };

  return {
    repeat: settings,
    setEach: (value: number) => setEach(clamp(value, 1, MAX_REPEAT)),
    setWhole: (value: number) => setWhole(clamp(value, REPEAT_FOREVER, MAX_REPEAT)),
  };
}

export const isPlayOnce = ({ each, whole }: RepeatSettings) => each === 1 && whole === 1;

/** Even shorter, for narrow screens: "Once", "3×", "3× · ∞". */
export function describeRepeatShort({ each, whole }: RepeatSettings): string {
  if (isPlayOnce({ each, whole })) return "Once";
  const parts: string[] = [];
  if (each > 1) parts.push(`${each}×`);
  if (whole === REPEAT_FOREVER) parts.push("∞");
  else if (whole > 1) parts.push(`${whole}×`);
  return parts.join(" · ");
}

/** Short text for the repeat pill, e.g. "Play once" or "3× each · 5× range". */
export function describeRepeat({ each, whole }: RepeatSettings): string {
  if (isPlayOnce({ each, whole })) return "Play once";
  const parts: string[] = [];
  if (each > 1) parts.push(`${each}× each`);
  if (whole === REPEAT_FOREVER) parts.push("loop");
  else if (whole > 1) parts.push(`${whole}× range`);
  return parts.join(" · ");
}

// ─── Native queue expansion ───
// The native player only knows a flat queue, so repeats become duplicate
// entries. Each entry gets a unique id; `baseTrackUrl` maps it back.

const REPEAT_ID_SEPARATOR = "#";

export type QueueEntry = { id: string; track: TrackObject };

export const baseTrackUrl = (id: string): string => id.split(REPEAT_ID_SEPARATOR)[0];

export function expandForQueue(
  tracks: TrackObject[],
  { each, whole }: RepeatSettings,
  // A looping range is repeated by the player itself, not by duplication.
  canExpandWhole: boolean
): QueueEntry[] {
  const passes = canExpandWhole && whole !== REPEAT_FOREVER ? whole : 1;
  const entries: QueueEntry[] = [];
  let copy = 0;
  for (let pass = 0; pass < passes; pass++) {
    for (const track of tracks) {
      for (let n = 0; n < each; n++) {
        entries.push({
          id: copy === 0 ? track.trackUrl : `${track.trackUrl}${REPEAT_ID_SEPARATOR}${copy}`,
          track,
        });
        copy++;
      }
    }
  }
  return entries;
}
