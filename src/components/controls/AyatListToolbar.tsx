import type { MemorizationStatus } from "../hooks/useMemorization";


const iconButtonClass = (active: boolean) =>
  `grid h-9 w-9 place-items-center rounded-lg border ${
    active
      ? "border-indigo-200 bg-indigo-50 text-primary"
      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50"
  }`;

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <path d="M17.9 17.9A10.1 10.1 0 0112 19c-6.4 0-10-7-10-7a18 18 0 014.1-5M9.9 5.2A9.7 9.7 0 0112 5c6.4 0 10 7 10 7a18 18 0 01-2.2 3.2M1 1l22 22" />
    ) : (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.5" />
  </svg>
);

type ListToggleButtonsProps = {
  hideText: boolean;
  onToggleHideText: () => void;
  trackMemorization: boolean;
  onToggleTracking: () => void;
};

/** Eye (hide text) and check-circle (track memorization) icon buttons. */
export const ListToggleButtons = ({
  hideText,
  onToggleHideText,
  trackMemorization,
  onToggleTracking,
}: ListToggleButtonsProps) => (
  <>
    <button
      type="button"
      className={iconButtonClass(hideText)}
      onClick={onToggleHideText}
      aria-pressed={hideText}
      aria-label={hideText ? "Show Arabic text" : "Hide Arabic text"}
      title={hideText ? "Show Arabic text" : "Hide Arabic text (test yourself)"}
    >
      <EyeIcon off={hideText} />
    </button>
    <button
      type="button"
      className={iconButtonClass(trackMemorization)}
      onClick={onToggleTracking}
      aria-pressed={trackMemorization}
      aria-label={trackMemorization ? "Stop tracking memorization" : "Track memorization"}
      title={trackMemorization ? "Hide memorization tracking" : "Track what you have memorized"}
    >
      <CheckCircleIcon />
    </button>
  </>
);

type MemorizationSummaryProps = {
  numberOfAyats: number;
  statuses: Record<string, MemorizationStatus>;
  counts: { memorized: number; revise: number; fresh: number };
};

/** Summary line and one-segment-per-ayat progress strip. Only shown while tracking. */
export const MemorizationSummary = ({ numberOfAyats, statuses, counts }: MemorizationSummaryProps) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="flex"
      style={{ gap: numberOfAyats > 150 ? 0 : numberOfAyats > 40 ? 1 : 3 }}
      aria-hidden="true"
    >
      {Array.from({ length: numberOfAyats }, (_, i) => {
        const status = statuses[i + 1];
        return (
          <i
            key={i}
            className={`block h-[5px] min-w-0 flex-1 ${
              status === "memorized" ? "bg-emerald-600" : status === "revise" ? "bg-amber-600" : "bg-slate-200"
            }`}
          />
        );
      })}
    </div>
    <div className="text-xs text-slate-500">
      {counts.memorized} memorized · {counts.revise} to revise · {counts.fresh} new
    </div>
  </div>
);
