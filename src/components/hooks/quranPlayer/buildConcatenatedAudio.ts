import type { TrackObject } from "../../../_main/types";
import type { TrackOffset } from "./types";

type BuildProgress = {
  loaded: number;
  total: number;
};

type BuildOptions = {
  tracks: TrackObject[];
  onProgress: (progress: BuildProgress) => void;
  isStale: () => boolean;
};

type BuildResult = {
  blobUrl: string;
  offsets: TrackOffset[];
  duration: number;
};

function writeStr(view: DataView, offset: number, str: string) {
  for (let index = 0; index < str.length; index++) {
    view.setUint8(offset + index, str.charCodeAt(index));
  }
}

async function fetchWithTimeout(url: string, maxRetries = 3, bypassCache = false): Promise<ArrayBuffer> {
  const isMobile = /iPhone|iPad|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const timeoutMs = isMobile ? 60_000 : 30_000; // 60s on mobile, 30s on desktop

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        signal: controller.signal,
      };

      let fetchUrl = url;

      // Force fresh fetch if we suspect cache corruption
      if (bypassCache || attempt > 1) {
        fetchOptions.cache = "no-store";
        // Also add a cache-buster to URL
        const cacheBuster = `cb=${Date.now()}`;
        fetchUrl = url.includes("?") ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
      }

      const response = await fetch(fetchUrl, fetchOptions);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      clearTimeout(timeoutId);

      // Validate: audio files should be at least 100 bytes
      if (arrayBuffer.byteLength < 100) {
        const error = new Error(
          `Audio file too small (${arrayBuffer.byteLength}b), likely corrupted or cached as empty`
        );
        console.warn(`Validation failed for ${url}:`, error);

        // Retry with cache bypass
        if (attempt < maxRetries) {
          console.log(`Retrying ${url} with cache bypass...`);
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        throw error;
      }

      return arrayBuffer;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      clearTimeout(timeoutId);

      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
        console.warn(
          `Fetch attempt ${attempt}/${maxRetries} failed for ${url}, retrying in ${delayMs}ms:`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(`Failed to fetch ${url} after ${maxRetries} attempts:`, lastError);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

export async function buildConcatenatedAudio({
  tracks,
  onProgress,
  isStale,
}: BuildOptions): Promise<BuildResult | null> {
  try {
    if (tracks.length === 0) {
      return null;
    }

    const total = tracks.length;
    onProgress({ loaded: 0, total });

  const rawBuffers = await Promise.allSettled(
    tracks.map(({ trackUrl }) => fetchWithTimeout(trackUrl))
  );

  if (isStale()) {
    return null;
  }

  // Check for fetch failures and report clearly
  const failedTracks: string[] = [];
  rawBuffers.forEach((result, index) => {
    if (result.status === "rejected") {
      failedTracks.push(`${tracks[index].surahNumber}:${tracks[index].ayatNumber}`);
    }
  });

  if (failedTracks.length > 0) {
    const error = new Error(
      `Failed to fetch ${failedTracks.length} track(s): ${failedTracks.join(", ")}`
    );
    console.error(error.message);
    throw error;
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const sampleRate = audioCtx.sampleRate;
  const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const decodedAudios: { buffer: AudioBuffer; numSamples: number }[] = [];
  let maxChannels = 1;
  let loaded = 0;

  for (let index = 0; index < rawBuffers.length; index++) {
    const result = rawBuffers[index];
    let decoded: AudioBuffer;

    if (result.status === "fulfilled" && result.value.byteLength > 0) {
      try {
        decoded = await audioCtx.decodeAudioData(result.value.slice(0));
      } catch (error) {
        const trackInfo = `${tracks[index].surahNumber}:${tracks[index].ayatNumber}`;
        console.error(`Failed to decode track ${trackInfo}:`, error);
        throw new Error(`Audio decode failed for track ${trackInfo}`);
      }
    } else {
      const trackInfo = `${tracks[index].surahNumber}:${tracks[index].ayatNumber}`;
      throw new Error(`Missing audio data for track ${trackInfo}`);
    }

    decodedAudios.push({ buffer: decoded, numSamples: decoded.length });
    maxChannels = Math.max(maxChannels, decoded.numberOfChannels);

    loaded += 1;
    onProgress({ loaded, total });
    await yieldToUi();

    if (isStale()) {
      await audioCtx.close();
      return null;
    }
  }

  let totalSamples = 0;
  const offsets: TrackOffset[] = [];

  for (let index = 0; index < decodedAudios.length; index++) {
    const startTime = totalSamples / sampleRate;
    totalSamples += decodedAudios[index].numSamples;
    const endTime = totalSamples / sampleRate;

    offsets.push({
      trackUrl: tracks[index].trackUrl,
      startTime,
      endTime,
    });
  }

  const bytesPerSample = 2;
  const dataLength = totalSamples * maxChannels * bytesPerSample;
  const headerLength = 44;
  const wavBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(wavBuffer);

  writeStr(view, 0, "RIFF");
  view.setUint32(4, headerLength + dataLength - 8, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, maxChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * maxChannels * bytesPerSample, true);
  view.setUint16(32, maxChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(view, 36, "data");
  view.setUint32(40, dataLength, true);

  const pcmData = new Int16Array(wavBuffer, headerLength);
  let sampleWriteIndex = 0;

  for (const { buffer } of decodedAudios) {
    const channels: Float32Array[] = [];

    for (let channelIndex = 0; channelIndex < maxChannels; channelIndex++) {
      const sourceChannel = channelIndex < buffer.numberOfChannels ? channelIndex : 0;
      channels.push(buffer.getChannelData(sourceChannel));
    }

    for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex++) {
      for (let channelIndex = 0; channelIndex < maxChannels; channelIndex++) {
        const value = channels[channelIndex][sampleIndex];
        pcmData[sampleWriteIndex++] = value < 0 ? value * 0x8000 : value * 0x7fff;
      }
    }

    await yieldToUi();

    if (isStale()) {
      await audioCtx.close();
      return null;
    }
  }

  await audioCtx.close();

  const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
  const blobUrl = URL.createObjectURL(wavBlob);

  console.log(
    `Audio ready: ${tracks.length} tracks, ${(totalSamples / sampleRate).toFixed(1)}s, ` +
      `${maxChannels}ch ${sampleRate}Hz, ${(wavBlob.size / 1024 / 1024).toFixed(1)}MB WAV`
  );

    return {
      blobUrl,
      offsets,
      duration: totalSamples / sampleRate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Audio build failed:", message);
    return null;
  }
}
