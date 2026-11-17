import { useEffect, useRef } from "react";
import { useLocalStorage } from "usehooks-ts";
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
  onCancelPick: () => void;
  /** An ayah outside the range was tapped; the parent confirms before leaving the range. */
  onPlayOutsideRange: (ayatNumber: number) => void;
}

const STATUS_TEXT: Record<string, string> = {
  new: "text-slate-500",
  revise: "text-slate-700",
  memorized: "text-emerald-700",
};

/**
 * Every ayah of the surah, with the selected range marked. The number on each
 * row starts a new range; a tap anywhere else on the row plays that ayah
 * (outside the range, after the parent confirms). While a range is being
 * picked, a bar at the top says so and a tap anywhere on a row ends the range.
 * Only this list scrolls.
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
  onCancelPick,
  onPlayOutsideRange,
}) => {
  const surahText = useSurahText(surahNumber);
  const listRef = useRef<HTMLOListElement | null>(null);
  const [start, end] = ayatRange;
  const memorizing = mode === "memorize";
  const picking = pendingStart !== null;
  // Shown until the user has picked a range from the list once, or dismisses it.
  const [rangeTipSeen, setRangeTipSeen] = useLocalStorage<boolean>("rangeTipSeen", false);
  const pick = (n: number) => {
    setRangeTipSeen(true);
    onPickNumber(n);
  };

  // Bring the start of the range into view when it changes or the text arrives.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-ayat="${start}"]`);
    if (!list || !row) return;
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    // Keep the row clear of the tip bar when it is pinned at the top.
    const pinned = list.querySelector<HTMLElement>(":scope > li.sticky")?.offsetHeight ?? 0;
    list.scrollTop += offset - 8 - pinned;
  }, [start, surahNumber, surahText]);

  return (
    <ol ref={listRef} data-ayat-list className="player-list min-h-0 flex-1 overflow-y-auto" aria-label="Ayat">
      {picking ? (
        <li className="sticky top-0 z-10 flex items-center gap-3 border-b border-indigo-200 bg-indigo-50 py-1.5 pl-4 pr-2 text-sm text-indigo-900" aria-live="polite">
          <span className="min-w-0 flex-1">
            New range from <b className="tabular-nums">{pendingStart}</b>. Now tap the ayah it should end on.
          </span>
          <button
            type="button"
            onClick={onCancelPick}
            className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-primary hover:bg-indigo-100"
          >
            Cancel
          </button>
        </li>
      ) : (
        !rangeTipSeen && (
          <li className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white py-1.5 pl-4 pr-2 text-sm text-slate-600">
            <span className="min-w-0 flex-1">
              Tap an ayah <b className="font-semibold text-slate-900">number</b> to start a new range.
            </span>
            <button
              type="button"
              onClick={() => setRangeTipSeen(true)}
              className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-primary hover:bg-slate-50"
            >
              Got it
            </button>
          </li>
        )
      )}
      {Array.from({ length: numberOfAyats }, (_, index) => {
        const n = index + 1;
        const selected = n >= start && n <= end;
        const track = selected ? tracksToPlay[n - start] : undefined;
        const isActive = Boolean(track && track.trackUrl === activeTrackUrl);
        const isPending = pendingStart === n;
        // While picking, the old range steps aside and only the new start is marked.
        const inRange = picking ? isPending : selected;
        const isEdge = !picking && inRange && start !== end && (n === start || n === end);
        const hidden = memorizing && !revealed[n];
        const status = statuses[n] ?? "new";
        const arabic = surahText?.[index];

        const isFrom = picking ? isPending : inRange && n === start;
        const isTo = !picking && inRange && n === end;
        const numberClass = isPending
          ? "bg-primary text-white"
          : picking
            ? // Every other number becomes a visible target for the end of the range.
              "bg-white text-primary ring-1 ring-inset ring-indigo-300"
            : isActive
              ? "bg-primary text-white"
              : isFrom || isTo
                ? "text-primary group-hover/num:bg-indigo-50"
                : inRange
                  ? "text-slate-700 group-hover/num:bg-indigo-50 group-hover/num:text-primary"
                  : "text-slate-400 group-hover/num:bg-indigo-50 group-hover/num:text-primary";
        // Alternate rows get a faint tint so the eye can tell one ayah from the next.
        const rowClass = isActive
          ? "bg-indigo-50"
          : index % 2 === 1
            ? "bg-slate-50 hover:bg-slate-100"
            : "bg-white hover:bg-slate-100/70";
        const textClass = isActive ? "text-indigo-950" : inRange || picking ? "text-slate-900" : "text-slate-500";
        // While picking, a tap anywhere on a row ends the range instead of playing.
        const play = () =>
          picking ? pick(n) : track ? handleAyatClick(track.trackUrl) : onPlayOutsideRange(n);

        const text = hidden ? (
          <div className={`ayat-hidden-line ${inRange || picking ? "" : "opacity-50"}`} aria-label="Hidden ayah" />
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
            className={`flex cursor-pointer border-b border-slate-200 last:border-b-0 ${rowClass}`}
          >
            <div className="ayat-gutter flex w-14 shrink-0 flex-col items-center pt-1.5">
              {/* A 44px tap target around a small numeral; no circle. */}
              <button
                type="button"
                onClick={() => pick(n)}
                aria-label={picking ? `End the range at ayah ${n}` : `Start a new range at ayah ${n}`}
                title={picking ? `End the range at ${n}` : `Start a new range at ${n}`}
                className="group/num grid h-11 min-w-11 place-items-start justify-center pt-1.5"
              >
                <span
                  className={`block h-6 min-w-8 rounded-md px-1 text-[13px] font-semibold leading-6 tabular-nums ${numberClass}`}
                >
                  {n}
                </span>
              </button>
              {(isEdge || isPending) && (
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
                aria-label={
                  picking
                    ? `End the range at ayah ${n}`
                    : track
                      ? `Play ayah ${n}`
                      : `Play from ayah ${n}, leaving the range`
                }
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
