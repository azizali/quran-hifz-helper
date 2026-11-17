import { QURAN_SCRIPTS, TAJWEED_LEGEND, type QuranScript } from "../quranText";

type TextSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: QuranScript;
  onScriptChange: (script: QuranScript) => void;
  tajweed: boolean;
  onTajweedChange: (tajweed: boolean) => void;
  textScale: number;
  onTextScaleChange: (scale: number) => void;
};

/** Text sizes, as a multiple of the default. */
const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.4];

const nearestScaleIndex = (scale: number) =>
  TEXT_SCALES.reduce((best, s, i) => (Math.abs(s - scale) < Math.abs(TEXT_SCALES[best] - scale) ? i : best), 1);

/** Bottom sheet for how the Quran text looks: the script, and tajweed colours. */
export const TextSettingsSheet = ({
  open,
  onOpenChange,
  script,
  onScriptChange,
  tajweed,
  onTajweedChange,
  textScale,
  onTextScaleChange,
}: TextSettingsSheetProps) => {
  if (!open) return null;
  const tajweedAvailable = script === "uthmani";
  const scaleIndex = nearestScaleIndex(textScale);
  const sizeButton =
    "grid h-11 w-12 place-items-center bg-slate-50 font-semibold text-slate-700 hover:bg-indigo-50 hover:text-primary disabled:text-slate-300 disabled:hover:bg-slate-50";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close text settings"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-label="Quran text"
        className="safe-area-y relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-lg animate-slide-in-up"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded bg-slate-300" />
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Quran text</h2>
            <button
              type="button"
              className="min-h-11 px-1 text-sm font-bold text-primary"
              onClick={() => onOpenChange(false)}
            >
              Done
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-slate-900">Text size</span>
              <span className="block text-xs tabular-nums text-slate-500">
                {Math.round(TEXT_SCALES[scaleIndex] * 100)}%
                {scaleIndex !== 1 && (
                  <button
                    type="button"
                    onClick={() => onTextScaleChange(1)}
                    className="ml-2 font-semibold text-primary"
                  >
                    Reset
                  </button>
                )}
              </span>
            </span>
            <div className="flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Text size">
              <button
                type="button"
                className={`${sizeButton} text-sm`}
                aria-label="Smaller text"
                disabled={scaleIndex === 0}
                onClick={() => onTextScaleChange(TEXT_SCALES[scaleIndex - 1])}
              >
                A−
              </button>
              <button
                type="button"
                className={`${sizeButton} border-l border-slate-200 text-lg`}
                aria-label="Larger text"
                disabled={scaleIndex === TEXT_SCALES.length - 1}
                onClick={() => onTextScaleChange(TEXT_SCALES[scaleIndex + 1])}
              >
                A+
              </button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Script</legend>
            <div className="flex flex-col gap-2">
              {QURAN_SCRIPTS.map((option) => {
                const selected = option.id === script;
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 ${
                      selected ? "border-primary bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="quran-script"
                        value={option.id}
                        checked={selected}
                        onChange={() => onScriptChange(option.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                      <span className="truncate text-xs text-slate-500">{option.hint}</span>
                    </span>
                    <span className="ayat-arabic text-slate-900" data-script={option.id} lang="ar">
                      {option.sample}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <label className={`flex items-center justify-between gap-3 ${tajweedAvailable ? "cursor-pointer" : ""}`}>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Tajweed colours</span>
                <span className="block text-xs text-slate-500">
                  {tajweedAvailable
                    ? "Colours letters by their tajweed rule"
                    : "Available with the Uthmani script"}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={tajweedAvailable && tajweed}
                disabled={!tajweedAvailable}
                onChange={(e) => onTajweedChange(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
            </label>

            {tajweedAvailable && tajweed && (
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700">
                {TAJWEED_LEGEND.map(({ label, rules }) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                      {rules.map((rule) => (
                        <span key={rule} className={`tj-${rule} block h-3 w-3 rounded-sm bg-current`} />
                      ))}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextSettingsSheet;
