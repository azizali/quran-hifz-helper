import type { SURAH } from "../../_main/types";
import { canSaveOffline, useOfflineAyahs } from "../hooks/useOfflineAyahs";
import DownloadSheet from "./DownloadSheet";
import type { QariKey } from "./qari";

type OfflineStatusProps = {
  surah: SURAH;
  qariKey: QariKey;
  ayatRange: [number, number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Status line under the surah picker. Opens the sheet for downloading and removing ayahs. */
export const OfflineStatus = ({ surah, qariKey, ayatRange, open, onOpenChange }: OfflineStatusProps) => {
  const offline = useOfflineAyahs(surah.number, qariKey);

  if (!canSaveOffline()) return null;

  const { downloaded, progress } = offline;
  const complete = downloaded.size >= surah.numberOfAyats;

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left text-sm font-semibold text-indigo-900"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" />
        </svg>
        <span className="min-w-0 flex-1">
          {progress
            ? `Downloading ${progress.loaded} of ${progress.total}…`
            : complete
              ? "Saved on this device"
              : `Offline: ${downloaded.size} of ${surah.numberOfAyats} ayahs`}
          <span className="block text-xs font-normal text-indigo-700">
            {progress ? "Tap to see progress" : "Tap to download or remove ayahs"}
          </span>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      <DownloadSheet
        open={open}
        onClose={() => onOpenChange(false)}
        surahName={surah.name}
        numberOfAyats={surah.numberOfAyats}
        ayatRange={ayatRange}
        downloaded={downloaded}
        avgBytes={offline.avgBytes}
        progress={progress}
        error={offline.error}
        onDownload={offline.download}
        onRemove={offline.remove}
      />
    </>
  );
};

export default OfflineStatus;
