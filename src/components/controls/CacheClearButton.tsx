import { useCallback, useState } from "react";
import { fullCacheClear } from "../../utils/cacheUtils";

const CacheClearButton = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClearCache = useCallback(async () => {
    setIsClearing(true);
    setError(null);

    try {
      await fullCacheClear();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsClearing(false);
    }
  }, []);

  if (error) {
    return (
      <div className="px-4 py-2 bg-yellow-50 border border-yellow-300 text-yellow-800 text-xs">
        <div className="mb-1">Cache clear failed: {error}</div>
        <button
          onClick={() => setError(null)}
          className="text-yellow-600 underline hover:text-yellow-800 font-semibold"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (isClearing) {
    return (
      <div className="px-4 py-2 bg-blue-50 border border-blue-300 text-blue-800 text-xs">
        Clearing cache and reloading...
      </div>
    );
  }

  return (
    <button
      onClick={handleClearCache}
      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs rounded font-semibold"
      title="Clear corrupted audio cache and reload"
    >
      Clear Cache
    </button>
  );
};

export default CacheClearButton;
