import { useEffect, useState } from "react";
import { isNativePlatform } from "../_main/platform";
import { getDownloadedTrackUrls } from "../native-audio/downloadManager";

export function useCachedAssets(cacheName: string, dependencies: any[] = []) {
  const [cachedUrls, setCachedUrls] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isNativePlatform()) {
      const checkDownloads = async () => {
        const urls = await getDownloadedTrackUrls();
        setCachedUrls(Object.fromEntries(urls.map((url) => [url, true])));
      };

      checkDownloads();
      const interval = setInterval(checkDownloads, 2000);
      return () => clearInterval(interval);
    }

    if ("caches" in window) {
      const checkCache = async () => {
        try {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          const urlObject: Record<string, boolean> = {};
          requests.forEach((request) => {
            urlObject[request.url] = true;
          });
          setCachedUrls(urlObject);
        } catch (error) {
          console.error("Error checking cache:", error);
        }
      };
      
      checkCache();
      
      // Check cache periodically to catch newly cached items
      const interval = setInterval(checkCache, 2000);
      
      return () => clearInterval(interval);
    }
  }, dependencies);

  return cachedUrls;
}
