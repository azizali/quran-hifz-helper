export async function clearAudioCache(): Promise<void> {
  try {
    if (!("caches" in window)) {
      throw new Error("Cache API not available");
    }

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );

    console.log(`Cleared ${cacheNames.length} cache(s)`);
  } catch (error) {
    console.error("Failed to clear cache:", error);
    throw error;
  }
}

export async function clearServiceWorker(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker not available");
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));

    console.log(`Unregistered ${registrations.length} service worker(s)`);
  } catch (error) {
    console.error("Failed to unregister service worker:", error);
    throw error;
  }
}

export async function fullCacheClear(): Promise<void> {
  await clearAudioCache();
  await clearServiceWorker();
  // Force page reload to pick up fresh data
  window.location.reload();
}
