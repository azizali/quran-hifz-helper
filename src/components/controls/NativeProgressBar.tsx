import { useEffect, useState } from "react";
import { NativeQuranAudio, type PositionUpdateEvent } from "../../native-audio";

const formatTime = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
};

type NativeProgressBarProps = {
  trackCount: number;
};

const NativeProgressBar = ({ trackCount }: NativeProgressBarProps) => {
  const [status, setStatus] = useState<PositionUpdateEvent | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  useEffect(() => {
    const handle = NativeQuranAudio.addListener("positionUpdate", setStatus);
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

  const index = status?.index ?? 0;
  const position = status?.positionSeconds ?? 0;
  const duration = status?.durationSeconds ?? 0;
  const liveValue = index + (duration > 0 ? Math.min(position / duration, 1) : 0);

  // Only the current ayat's duration is known, so other ayats seek to their start.
  const commitSeek = (value: number) => {
    setDragValue(null);
    const targetIndex = Math.min(Math.floor(value), trackCount - 1);
    const positionSeconds = targetIndex === index ? (value - targetIndex) * duration : 0;
    NativeQuranAudio.seek({ index: targetIndex, positionSeconds }).catch(console.error);
  };

  return (
    <div className="flex items-center gap-2 px-4 pb-2 text-xs tabular-nums text-slate-600">
      <span>{formatTime(position)}</span>
      <input
        type="range"
        aria-label="Playback position"
        className="flex-1 accent-primary"
        min={0}
        max={trackCount}
        step={0.01}
        value={dragValue ?? liveValue}
        onChange={(event) => setDragValue(Number(event.target.value))}
        onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
      />
      <span>{formatTime(duration)}</span>
    </div>
  );
};

export default NativeProgressBar;
