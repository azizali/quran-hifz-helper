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

async function fetchWithTimeout(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return new ArrayBuffer(0);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function buildConcatenatedAudio({
  tracks,
  onProgress,
  isStale,
}: BuildOptions): Promise<BuildResult | null> {
  if (tracks.length === 0) {
    return null;
  }

  const total = tracks.length;
  onProgress({ loaded: 0, total });

  const rawBuffers = await Promise.all(
    tracks.map(({ trackUrl }) => fetchWithTimeout(trackUrl))
  );

  if (isStale()) {
    return null;
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const sampleRate = audioCtx.sampleRate;
  const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const decodedAudios: { buffer: AudioBuffer; numSamples: number }[] = [];
  let maxChannels = 1;
  let loaded = 0;

  for (const rawBuffer of rawBuffers) {
    let decoded: AudioBuffer;

    if (rawBuffer.byteLength > 0) {
      try {
        decoded = await audioCtx.decodeAudioData(rawBuffer.slice(0));
      } catch {
        decoded = audioCtx.createBuffer(1, Math.round(sampleRate * 0.01), sampleRate);
      }
    } else {
      decoded = audioCtx.createBuffer(1, Math.round(sampleRate * 0.01), sampleRate);
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
}
