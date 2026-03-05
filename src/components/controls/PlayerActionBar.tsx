import { type TrackUrl } from "../../_main/types";

type PlayerActionBarProps = {
  isPlaying: boolean;
  activeTrackUrl: TrackUrl;
  activeAyatNumber: number;
  startingAyatNumber: number;
  handlePlay: (args: { activeTrackUrl: TrackUrl }) => void;
  handlePause: () => void;
  handleReset: () => void;
};

const PlayerActionBar = ({
  isPlaying,
  activeTrackUrl,
  activeAyatNumber,
  startingAyatNumber,
  handlePlay,
  handlePause,
  handleReset,
}: PlayerActionBarProps) => {
  return (
    <div className="inline-flex shadow-sm" role="group">
      {!isPlaying && (
        <button
          className="btn bg-primary font-bold text-xl text-white w-full p-3"
          onClick={() => handlePlay({ activeTrackUrl })}
        >
          Play
        </button>
      )}
      {isPlaying && (
        <button
          className="btn bg-primary font-bold text-xl text-white w-full p-3"
          onClick={handlePause}
        >
          Pause
        </button>
      )}
      {activeAyatNumber > startingAyatNumber && (
        <button
          className="btn bg-secondary font-bold text-xl text-white p-3"
          onClick={handleReset}
        >
          Restart
        </button>
      )}
    </div>
  );
};

export default PlayerActionBar;

