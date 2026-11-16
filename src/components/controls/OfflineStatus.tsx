import type { SURAH } from "../../_main/types";
import { canSaveOffline, useOfflineAyahs } from "../hooks/useOfflineAyahs";
import CloudIcon from "../icons/CloudIcon";
import DownloadSheet from "./DownloadSheet";
import type { QariKey } from "./qari";

type OfflineStatusProps = {
  surah: SURAH;
  qariKey: QariKey;
  ayatRange: [number, number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Small icon button showing how much of the surah is saved; opens the download sheet. */
export const OfflineStatus = ({ surah, qariKey, ayatRange, open, onOpenChange }: OfflineStatusProps) => {
  const offline = useOfflineAyahs(surah.number, qariKey);

  if (!canSaveOffline()) return null;

  const { downloaded, progress } = offline;
  const total = surah.numberOfAyats;
  const complete = downloaded.size >= total;
  const label = progress
    ? `Saving ${progress.loaded}/${progress.total}`
    : downloaded.size === 0
      ? "Not offline"
      : `${downloaded.size}/${total} offline`;

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={`Offline: ${label}. Manage downloads.`}
        className={`flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium tabular-nums hover:bg-slate-50 ${
          complete ? "text-emerald-700" : progress ? "text-primary" : "text-slate-500"
        }`}
      >
        <CloudIcon checked={complete} />
        <span>{label}</span>
      </button>
      <DownloadSheet
        open={open}
        onClose={() => onOpenChange(false)}
        surahName={surah.name}
        numberOfAyats={total}
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
