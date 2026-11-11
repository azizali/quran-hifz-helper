import { useEffect, useMemo, useRef, useState } from "react";
import { isNativePlatform } from "../../_main/platform";
import { fullCacheClear } from "../../utils/cacheUtils";
import type { DownloadProgress } from "../hooks/useOfflineAyahs";

// Surahs up to this many ayat get the one-button view first.
const SHORT_SURAH_MAX = 30;

type DownloadSheetProps = {
  open: boolean;
  onClose: () => void;
  surahName: string;
  numberOfAyats: number;
  ayatRange: [number, number];
  downloaded: Set<number>;
  avgBytes: number;
  progress: DownloadProgress | null;
  error: string | null;
  onDownload: (ayatNumbers: number[]) => void;
  onRemove: (ayatNumbers: number[]) => void;
};

const formatSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  return mb < 0.1 ? "under 0.1 MB" : `${mb.toFixed(1)} MB`;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const DownloadSheet = ({
  open,
  onClose,
  surahName,
  numberOfAyats,
  ayatRange,
  downloaded,
  avgBytes,
  progress,
  error,
  onDownload,
  onRemove,
}: DownloadSheetProps) => {
  const isShort = numberOfAyats <= SHORT_SURAH_MAX;
  const [picking, setPicking] = useState(!isShort);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const drag = useRef<{ start: number; adding: boolean; base: Set<number> } | null>(null);

  // Start fresh each time the sheet opens. A range you narrowed down is preselected; the whole surah is not.
  useEffect(() => {
    if (!open) return;
    setConfirmReset(false);
    setResetError(null);
    setPicking(!isShort);
    const isWholeSurah = ayatRange[0] === 1 && ayatRange[1] === numberOfAyats;
    setSelected(isShort || isWholeSurah ? new Set() : new Set(range(ayatRange[0], ayatRange[1])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, numberOfAyats]);

  const toGet = useMemo(() => [...selected].filter((n) => !downloaded.has(n)).sort((a, b) => a - b), [selected, downloaded]);
  const toRemove = useMemo(() => [...selected].filter((n) => downloaded.has(n)).sort((a, b) => a - b), [selected, downloaded]);
  const missing = useMemo(() => range(1, numberOfAyats).filter((n) => !downloaded.has(n)), [numberOfAyats, downloaded]);
  const busy = progress !== null;

  if (!open) return null;

  const cellFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const n = el?.dataset?.ayat;
    return n ? Number(n) : null;
  };

  const paint = (to: number) => {
    const d = drag.current;
    if (!d) return;
    const next = new Set(d.base);
    const [lo, hi] = [Math.min(d.start, to), Math.max(d.start, to)];
    for (let n = lo; n <= hi; n++) {
      if (d.adding) next.add(n);
      else next.delete(n);
    }
    setSelected(next);
  };

  const quick = (ayat: number[]) => setSelected(new Set(ayat));
  const nextBatch = () => {
    const batch = missing.filter((n) => n >= ayatRange[0]).slice(0, 20);
    quick(batch.length ? batch : missing.slice(0, 20));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`${surahName} offline`}
        className="safe-area-y relative flex max-h-[92dvh] w-full max-w-md flex-col gap-3 rounded-t-2xl bg-white p-5 shadow-lg animate-slide-in-up"
      >
        <div className="mx-auto h-1 w-10 rounded bg-slate-300" />
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">{surahName} offline</h2>
          <span className="text-xs text-slate-500">
            {downloaded.size} of {numberOfAyats} saved
          </span>
        </div>

        {isShort && !picking ? (
          <>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="font-semibold">Whole surah</div>
              <div className="text-sm text-slate-500">
                {numberOfAyats} ayahs · about {formatSize(numberOfAyats * avgBytes)}
              </div>
            </div>
            {downloaded.size < numberOfAyats ? (
              <button
                type="button"
                className="rounded-lg bg-primary p-3 font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
                disabled={busy}
                onClick={() => onDownload(range(1, numberOfAyats))}
              >
                {busy ? `Downloading ${progress.loaded}/${progress.total}…` : "Download surah"}
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg border border-red-200 p-3 font-bold text-red-700"
                onClick={() => onRemove(range(1, numberOfAyats))}
              >
                Remove from device
              </button>
            )}
            <button type="button" className="text-sm text-primary underline" onClick={() => setPicking(true)}>
              Choose specific ayahs
            </button>
          </>
        ) : (
          <>
            <div className="h-2 overflow-hidden rounded bg-slate-100" aria-hidden="true">
              <div className="flex h-full">
                {range(1, numberOfAyats).map((n) => (
                  <i
                    key={n}
                    className={`block h-full flex-1 ${
                      selected.has(n) ? "bg-primary" : downloaded.has(n) ? "bg-emerald-600" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border border-emerald-600 bg-emerald-100" />On device</span>
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border border-slate-300 bg-white" />Streams</span>
              <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border border-primary bg-primary" />Selected</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Next 20", run: nextBatch },
                { label: `Range ${ayatRange[0]}–${ayatRange[1]}`, run: () => quick(range(ayatRange[0], ayatRange[1])) },
                { label: "All missing", run: () => quick(missing) },
                { label: "Whole surah", run: () => quick(range(1, numberOfAyats)) },
                { label: "Clear", run: () => quick([]) },
              ].map(({ label, run }) => (
                <button key={label} type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-primary hover:text-primary" onClick={run}>
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 overflow-y-auto rounded-lg border border-slate-200 p-2" style={{ maxHeight: "13rem" }}>
              <div
                className="grid select-none grid-cols-7 gap-1"
                style={{ touchAction: "pan-y" }}
                role="group"
                aria-label={`Ayahs 1 to ${numberOfAyats}`}
                onPointerDown={(e) => {
                  const n = cellFromPoint(e.clientX, e.clientY);
                  if (!n || busy) return;
                  drag.current = { start: n, adding: !selected.has(n), base: new Set(selected) };
                  paint(n);
                }}
                onPointerMove={(e) => {
                  if (!drag.current) return;
                  const n = cellFromPoint(e.clientX, e.clientY);
                  if (n) paint(n);
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              >
                {range(1, numberOfAyats).map((n) => {
                  const isSelected = selected.has(n);
                  const isSaved = downloaded.has(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      data-ayat={n}
                      aria-pressed={isSelected}
                      aria-label={`Ayah ${n}${isSaved ? ", on device" : ""}`}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected((cur) => {
                            const next = new Set(cur);
                            if (next.has(n)) next.delete(n);
                            else next.add(n);
                            return next;
                          });
                        }
                      }}
                      className={`relative h-9 rounded-md border-[1.5px] text-xs tabular-nums ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : isSaved
                            ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                            : "border-slate-300 bg-white"
                      }`}
                    >
                      {n}
                      {isSaved && (
                        <span className={`absolute right-[3px] top-[3px] h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-600"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-center text-xs text-slate-500">Tap to select · drag across to select a range</div>
            <div className="flex flex-col gap-1.5">
              {busy ? (
                <button type="button" className="rounded-lg bg-slate-200 p-3 font-bold text-slate-500" disabled>
                  Downloading {progress.loaded}/{progress.total}…
                </button>
              ) : selected.size === 0 ? (
                <button type="button" className="rounded-lg bg-slate-200 p-3 font-bold text-slate-400" disabled>
                  Select ayahs
                </button>
              ) : (
                <>
                  {toGet.length > 0 && (
                    <button
                      type="button"
                      className="rounded-lg bg-primary p-3 font-bold text-white"
                      onClick={() => {
                        onDownload(toGet);
                        setSelected(new Set());
                      }}
                    >
                      Download {toGet.length} ayah{toGet.length > 1 ? "s" : ""} · {formatSize(toGet.length * avgBytes)}
                    </button>
                  )}
                  {toRemove.length > 0 && (
                    <button
                      type="button"
                      className={`rounded-lg border border-red-200 text-red-700 ${toGet.length ? "p-2 text-sm" : "p-3 font-bold"}`}
                      onClick={() => {
                        onRemove(toRemove);
                        setSelected(new Set());
                      }}
                    >
                      Remove {toRemove.length} from device · frees {formatSize(toRemove.length * avgBytes)}
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {error && (
          <div className="rounded bg-red-50 p-2 text-xs text-red-800" role="alert">
            Download stopped: {error}. Ayahs already saved were kept. Select the rest and try again.
          </div>
        )}
        <button type="button" className="self-center text-sm font-semibold text-primary" onClick={onClose}>
          Done
        </button>
        {!isNativePlatform() && (
          <div className="border-t border-slate-100 pt-2 text-center text-xs text-slate-500">
            {confirmReset ? (
              <div className="flex flex-col items-center gap-2">
                <span>This deletes all saved audio and the app&apos;s cached files, then reloads the page.</span>
                <span className="flex gap-4">
                  <button
                    type="button"
                    className="font-semibold text-red-700"
                    onClick={() =>
                      fullCacheClear().catch((err) =>
                        setResetError(err instanceof Error ? err.message : String(err))
                      )
                    }
                  >
                    Reset app
                  </button>
                  <button type="button" className="font-semibold text-primary" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </span>
                {resetError && (
                  <span role="alert" className="text-red-700">
                    Reset failed: {resetError}
                  </span>
                )}
              </div>
            ) : (
              <button type="button" className="underline" onClick={() => setConfirmReset(true)}>
                Something wrong? Reset app
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadSheet;
