import { useEffect, useRef } from "react";
import type { TrackObject, TrackUrl } from "../../_main/types";
import { nextStatusLabel, statusLabel, type MemorizationStatus } from "../hooks/useMemorization";
import { useSurahText } from "../hooks/useSurahText";
import type { PlayerMode } from "./RangeBar";

interface AyatListProps {
  surahNumber: number;
  numberOfAyats: number;
  ayatRange: [number, number];
  /** Tracks of the selected range, in order. Only these can be played. */
  tracksToPlay: TrackObject[];
  activeTrackUrl: TrackUrl;
  handleAyatClick: (track: TrackUrl) => void;
  mode: PlayerMode;
  revealed: Record<number, boolean>;
  onToggleReveal: (ayatNumber: number) => void;
  statuses: Record<string, MemorizationStatus>;
  onCycleStatus: (ayatNumber: number) => void;
  pendingStart: number | null;
  onPickNumber: (ayatNumber: number) => void;
  /** An ayah outside the range was tapped; the parent confirms before leaving the range. */
  onPlayOutsideRange: (ayatNumber: number) => void;
}

const STATUS_TEXT: Record<string, string> = {
  new: "text-slate-500",
  revise: "text-slate-700",
  memorized: "text-emerald-700",
};

/**
 * Every ayah of the surah, with the selected range tinted. The number on each
 * row picks the range; a tap anywhere else on the row plays that ayah (outside
 * the range, after the parent confirms). Only this list scrolls.
 */
export const AyatList: React.FC<AyatListProps> = ({
  surahNumber,
  numberOfAyats,
  ayatRange,
  tracksToPlay,
  activeTrackUrl,
  handleAyatClick,
  mode,
  revealed,
  onToggleReveal,
  statuses,
  onCycleStatus,
  pendingStart,
  onPickNumber,
  onPlayOutsideRange,
}) => {
  const surahText = useSurahText(surahNumber);
  const listRef = useRef<HTMLOListElement | null>(null);
  const [start, end] = ayatRange;
  const memorizing = mode === "memorize";

  // Bring the start of the range into view when it changes or the text arrives.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-ayat="${start}"]`);
    if (!list || !row) return;
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    list.scrollTop += offset - 8;
  }, [start, surahNumber, surahText]);

  return (
    <ol ref={listRef} data-ayat-list className="player-list min-h-0 flex-1 overflow-y-auto" aria-label="Ayat">
      {Array.from({ length: numberOfAyats }, (_, index) => {
        const n = index + 1;
        const inRange = n >= start && n <= end;
        const track = inRange ? tracksToPlay[n - start] : undefined;
        const isActive = Boolean(track && track.trackUrl === activeTrackUrl);
        const isEdge = inRange && start !== end && (n === start || n === end);
        const isPending = pendingStart === n;
        const hidden = memorizing && !revealed[n];
        const status = statuses[n] ?? "new";
        const arabic = surahText?.[index];

        const isFrom = inRange && n === start;
        const isTo = inRange && n === end;
        const numberClass = isActive
          ? "bg-primary text-white"
          : isPending
            ? "text-primary outline-dashed outline-[1.5px] outline-offset-1 outline-primary"
            : isFrom || isTo
              ? "text-primary"
              : inRange
                ? "text-slate-700 hover:bg-slate-100"
                : "text-slate-400 hover:bg-slate-100";
        const rowClass = isActive ? "bg-indigo-50" : "bg-white hover:bg-slate-50";
        const textClass = isActive ? "text-indigo-950" : inRange ? "text-slate-900" : "text-slate-500";
        const play = () => (track ? handleAyatClick(track.trackUrl) : onPlayOutsideRange(n));

        const text = hidden ? (
          <div className={`ayat-hidden-line ${inRange ? "" : "opacity-50"}`} aria-label="Hidden ayah" />
        ) : arabic ? (
          <p className={`ayat-arabic ${textClass}`} lang="ar">
            {arabic}
          </p>
        ) : (
          <p className="py-2 text-sm text-slate-500">Ayah {n}</p>
        );

        return (
          <li
            key={n}
            data-ayat={n}
            data-track-url={track?.trackUrl}
            // The whole row plays; its own buttons (number, status, show/hide) keep their actions.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              play();
            }}
            data-in-range={inRange || undefined}
            data-range-edge={[isFrom && "from", isTo && "to"].filter(Boolean).join(" ") || undefined}
            data-active={isActive || undefined}
            className={`flex cursor-pointer border-b border-slate-100 last:border-b-0 ${rowClass}`}
          >
            <div className="ayat-gutter flex w-14 shrink-0 flex-col items-center pt-1.5">
              {/* A 44px tap target around a small numeral; no circle. */}
              <button
                type="button"
                onClick={() => onPickNumber(n)}
                aria-label={`Ayah ${n}. Tap to set the range ${pendingStart !== null ? "end" : "start"}.`}
                className="grid h-11 min-w-11 place-items-start justify-center pt-1.5"
              >
                <span
                  className={`block h-6 min-w-8 rounded-md px-1 text-[13px] font-semibold leading-6 tabular-nums ${numberClass}`}
                >
                  {n}
                </span>
              </button>
              {isEdge && (
                <span className="-mt-3 text-[10px] font-semibold text-primary">{isFrom ? "From" : "To"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 py-1.5 pr-3">
              {/* Keyboard target for the row; mouse and touch taps reach the row's onClick. */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    play();
                  }
                }}
                aria-label={track ? `Play ayah ${n}` : `Play from ayah ${n}, leaving the range`}
                aria-current={isActive ? "true" : undefined}
                className="rounded"
              >
                {text}
              </div>
              {memorizing && (
                <div className="flex items-center justify-end gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onCycleStatus(n)}
                    aria-label={`Ayah ${n}: ${statusLabel(statuses[n])}. Tap to mark ${nextStatusLabel(statuses[n])}.`}
                    className={`flex min-h-9 items-center gap-1.5 px-1 ${STATUS_TEXT[status]}`}
                  >
                    <span className="status-mark" data-status={status} aria-hidden="true" />
                    {statusLabel(statuses[n])}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleReveal(n)}
                    className="min-h-9 px-1 font-semibold text-primary hover:text-indigo-700"
                  >
                    {hidden ? "Show" : "Hide"}
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default AyatList;
