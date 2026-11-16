type LeaveRangeSheetProps = {
  /** The ayah tapped outside the range, or null when closed. */
  ayatNumber: number | null;
  ayatRange: [number, number];
  numberOfAyats: number;
  onConfirm: (ayatNumber: number) => void;
  onCancel: () => void;
};

/** Asks before an ayah outside the range replaces the range and starts playing. */
export const LeaveRangeSheet = ({
  ayatNumber,
  ayatRange,
  numberOfAyats,
  onConfirm,
  onCancel,
}: LeaveRangeSheetProps) => {
  if (ayatNumber === null) return null;
  const [start, end] = ayatRange;
  const rangeText = start === end ? `ayah ${start}` : `ayahs ${start}–${end}`;
  const toEnd = ayatNumber === numberOfAyats ? `ayah ${ayatNumber}` : `ayah ${ayatNumber} to ${numberOfAyats}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Keep the range" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-labelledby="leave-range-title"
        aria-describedby="leave-range-body"
        className="safe-area-y relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-lg animate-slide-in-up"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded bg-slate-300" />
        <h2 id="leave-range-title" className="text-base font-bold">
          Play from ayah {ayatNumber}?
        </h2>
        <p id="leave-range-body" className="mt-1 text-sm text-slate-600">
          Ayah {ayatNumber} is outside your range ({rangeText}). Playing it clears the range and plays{" "}
          {toEnd}, the rest of the surah.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg border border-slate-300 font-semibold text-slate-700"
          >
            Keep range
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => onConfirm(ayatNumber)}
            className="min-h-11 flex-1 rounded-lg bg-primary font-bold text-white"
          >
            Play from {ayatNumber}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveRangeSheet;
