import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { surahs } from "../_main/config";
import type { TrackObject, TrackUrl } from "../_main/types";
import type { QariKey } from "../components/controls/qari";
import { getTracksToPlay } from "../components/utils";

const MANIFEST_PATH = "downloads/manifest.json";
const AUDIO_DIR = "downloads/audio";

// On iOS, Documents and Library are backed up to iCloud, which App Review
// rejects for re-downloadable content. LibraryNoCloud has no Android mapping.
const STORAGE_DIRECTORY =
  Capacitor.getPlatform() === "ios" ? Directory.LibraryNoCloud : Directory.Data;

export type DownloadManifestEntry = {
  trackUrl: TrackUrl;
  surahNumber: number;
  ayatNumber: number;
  qariKey: QariKey;
  // Relative: the iOS container path changes on every app update.
  fileName: string;
  bytes: number;
  downloadedAt: number;
};

type Manifest = Record<string, DownloadManifestEntry>;

type DownloadsChange = "added" | "removed";
const changeListeners = new Set<(change: DownloadsChange) => void>();

export function subscribeToDownloadChanges(listener: (change: DownloadsChange) => void) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

let manifestCache: Promise<Manifest> | null = null;

const loadManifest = async (): Promise<Manifest> => {
  try {
    const result = await Filesystem.readFile({
      path: MANIFEST_PATH,
      directory: STORAGE_DIRECTORY,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string) as Manifest;
  } catch {
    return {};
  }
};

function readManifest(): Promise<Manifest> {
  manifestCache ??= loadManifest();
  return manifestCache;
}

async function writeManifest(manifest: Manifest): Promise<void> {
  await Filesystem.writeFile({
    path: MANIFEST_PATH,
    directory: STORAGE_DIRECTORY,
    data: JSON.stringify(manifest),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  manifestCache = Promise.resolve(manifest);
}

function localFileName(track: TrackObject, qariKey: QariKey): string {
  return `${qariKey}_${track.surahNumber.toString().padStart(3, "0")}${track.ayatNumber
    .toString()
    .padStart(3, "0")}.mp3`;
}

const fullSurahTracks = (surahNumber: number, qariKey: QariKey) => {
  const surah = surahs[surahNumber - 1];
  return surah ? getTracksToPlay([1, surah.numberOfAyats], surahNumber, qariKey) : [];
};

export async function isSurahDownloaded(surahNumber: number, qariKey: QariKey): Promise<boolean> {
  const tracks = fullSurahTracks(surahNumber, qariKey);
  if (tracks.length === 0) return false;
  const manifest = await readManifest();
  return tracks.every((track) => Boolean(manifest[track.trackUrl]));
}

export async function downloadSurah(
  surahNumber: number,
  qariKey: QariKey,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const tracks = fullSurahTracks(surahNumber, qariKey);
  const manifest = await readManifest();

  let loaded = 0;
  onProgress?.(loaded, tracks.length);

  for (const track of tracks) {
    if (!manifest[track.trackUrl]) {
      const response = await fetch(track.trackUrl);
      if (!response.ok) {
        throw new Error(`Failed to download ${track.trackUrl}: HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const fileName = localFileName(track, qariKey);

      await Filesystem.writeFile({
        path: `${AUDIO_DIR}/${fileName}`,
        directory: STORAGE_DIRECTORY,
        data: arrayBufferToBase64(buffer),
        recursive: true,
      });

      manifest[track.trackUrl] = {
        trackUrl: track.trackUrl,
        surahNumber: track.surahNumber,
        ayatNumber: track.ayatNumber,
        qariKey,
        fileName,
        bytes: buffer.byteLength,
        downloadedAt: Date.now(),
      };
      await writeManifest(manifest);
    }

    loaded++;
    onProgress?.(loaded, tracks.length);
  }

  changeListeners.forEach((listener) => listener("added"));
}

export async function deleteSurahDownload(surahNumber: number, qariKey: QariKey): Promise<void> {
  const tracks = fullSurahTracks(surahNumber, qariKey);
  const manifest = await readManifest();

  for (const track of tracks) {
    const entry = manifest[track.trackUrl];
    if (!entry) continue;

    await Filesystem.deleteFile({
      path: `${AUDIO_DIR}/${entry.fileName}`,
      directory: STORAGE_DIRECTORY,
    }).catch(() => {});

    delete manifest[track.trackUrl];
  }

  await writeManifest(manifest);
  changeListeners.forEach((listener) => listener("removed"));
}

export async function getDownloadedTrackUrls(): Promise<string[]> {
  return Object.keys(await readManifest());
}

export async function getLocalPaths(): Promise<Map<string, string>> {
  const manifest = await readManifest();
  const entries = Object.values(manifest);
  if (entries.length === 0) return new Map();

  const { uri } = await Filesystem.getUri({ path: AUDIO_DIR, directory: STORAGE_DIRECTORY });
  const audioDirPath = decodeURI(uri.replace(/^file:\/\//, ""));
  return new Map(entries.map((entry) => [entry.trackUrl, `${audioDirPath}/${entry.fileName}`]));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
