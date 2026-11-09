import { useCallback, useEffect, useState } from "react";
import { isNativePlatform } from "../../_main/platform";
import {
  deleteSurahDownload,
  downloadSurah,
  isSurahDownloaded,
} from "../../native-audio/downloadManager";
import type { QariKey } from "./qari";

interface DownloadSurahButtonProps {
  surahNumber: number;
  qariKey: QariKey;
}

const DownloadSurahButton: React.FC<DownloadSurahButtonProps> = ({ surahNumber, qariKey }) => {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let cancelled = false;
    isSurahDownloaded(surahNumber, qariKey).then((downloaded) => {
      if (!cancelled) setIsDownloaded(downloaded);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNumber, qariKey]);

  const handleDownload = useCallback(async () => {
    setError(null);
    setProgress({ loaded: 0, total: 1 });
    try {
      await downloadSurah(surahNumber, qariKey, (loaded, total) => setProgress({ loaded, total }));
      setIsDownloaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  }, [surahNumber, qariKey]);

  const handleDelete = useCallback(async () => {
    await deleteSurahDownload(surahNumber, qariKey);
    setIsDownloaded(false);
  }, [surahNumber, qariKey]);

  if (!isNativePlatform()) return null;

  if (progress) {
    return (
      <span className="text-xs text-gray-500">
        Downloading {progress.loaded}/{progress.total}...
      </span>
    );
  }

  if (error) {
    return (
      <button onClick={handleDownload} className="text-xs text-red-600 underline">
        Download failed, retry
      </button>
    );
  }

  return isDownloaded ? (
    <button onClick={handleDelete} className="text-xs text-gray-500 underline">
      Downloaded &middot; Remove
    </button>
  ) : (
    <button onClick={handleDownload} className="text-xs text-blue-600 underline">
      Download for offline
    </button>
  );
};

export default DownloadSurahButton;
