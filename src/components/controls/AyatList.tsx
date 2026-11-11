import { useEffect, useState } from "react";
import type { TrackObject, TrackUrl } from "../../_main/types";
import { useSurahText } from "../hooks/useSurahText";
import type { MemorizationStatus } from "../hooks/useMemorization";
import SaveIcon from "../icons/SaveIcon";
import { useCachedAssets } from "../useCachedAssets";

interface AyatListProps {
  tracksToPlay: TrackObject[];
  activeTrackUrl: TrackUrl;
  activeAyatNumber: number;
  handleAyatClick: (track: TrackUrl) => void;
  isPlaying: boolean;
  /** Replace the Arabic with a bar until the ayat is tapped to reveal. */
  hideText: boolean;
  /** Show the memorized circle on each row. */
  trackMemorization: boolean;
  statuses: Record<string, MemorizationStatus>;
  onCycleStatus: (ayatNumber: number) => void;
}

const statusLabel = (status: MemorizationStatus | undefined) =>
  status === "memorized" ? "memorized" : status === "revise" ? "to revise" : "new";

const circleClass = (status: MemorizationStatus | undefined) =>
  status === "memorized"
    ? "border-emerald-600 bg-emerald-600 text-white"
    : status === "revise"
      ? "border-amber-600 bg-amber-600 text-white"
      : "border-slate-300 bg-white text-transparent hover:border-slate-400";

export const AyatList: React.FC<AyatListProps> = ({
  tracksToPlay,
  activeTrackUrl,
  handleAyatClick,
  isPlaying,
  hideText,
  trackMemorization,
  statuses,
  onCycleStatus,
}) => {
  const cachedAudio = useCachedAssets("audio-cache", [activeTrackUrl, isPlaying]);
  const surahNumber = tracksToPlay[0]?.surahNumber ?? 1;
  const surahText = useSurahText(surahNumber);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  // Hiding again (or changing surah) hides everything again.
  useEffect(() => {
    setRevealed({});
  }, [hideText, surahNumber]);

  return (
    <div className="min-h-0 overflow-y-auto border scroll-smooth rounded" role="list">
      {tracksToPlay.map(({ ayatNumber, trackUrl }, index) => {
        const isActiveTrack = activeTrackUrl === trackUrl;
        const arabic = surahText?.[ayatNumber - 1];
        const isHidden = hideText && !revealed[ayatNumber];
        const status = statuses[ayatNumber];
        const label = `Surah ${surahNumber} - Ayat ${ayatNumber}`;

        return (
          <div
            key={`${trackUrl}-${index}`}
            role="listitem"
            data-track-url={trackUrl}
            className={`flex items-center border-b last:border-b-0 ${
              isActiveTrack ? "bg-indigo-50" : "even:bg-slate-50"
            }`}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
              onClick={() => handleAyatClick(trackUrl)}
              aria-label={`${isActiveTrack ? "Current" : "Play"} ${label}`}
              aria-current={isActiveTrack ? "true" : undefined}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums ${
                  isActiveTrack
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {ayatNumber}
              </span>
              {arabic ? (
                isHidden ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Reveal ayat ${ayatNumber}`}
                    title="Tap to reveal"
                    className="h-4 flex-1 rounded-full opacity-70 hover:opacity-100"
                    style={{
                      background:
                        "repeating-linear-gradient(270deg,#cbd5e1 0 26px,transparent 26px 32px)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRevealed((current) => ({ ...current, [ayatNumber]: true }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setRevealed((current) => ({ ...current, [ayatNumber]: true }));
                      }
                    }}
                  />
                ) : (
                  <span className="ayat-arabic flex-1" lang="ar">
                    {arabic}
                  </span>
                )
              ) : (
                <span className={`flex-1 text-sm ${isActiveTrack ? "font-bold text-primary" : ""}`}>
                  {isActiveTrack ? "Current" : "Play"} {label}
                </span>
              )}
              {cachedAudio[trackUrl] && <SaveIcon />}
            </button>
            {trackMemorization && (
              <button
                type="button"
                className={`mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] ${circleClass(status)}`}
                onClick={() => onCycleStatus(ayatNumber)}
                aria-label={`Ayat ${ayatNumber} is ${statusLabel(status)}. Tap to change.`}
              >
                {status === "revise" ? (
                  <span aria-hidden="true">↻</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AyatList;
