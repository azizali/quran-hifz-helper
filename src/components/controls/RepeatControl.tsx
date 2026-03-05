type RepeatControlProps = {
  shouldRepeat: boolean;
  setShouldRepeat: (value: boolean) => void;
  activeAyatNumber: number;
};

const RepeatControl = ({
  shouldRepeat,
  setShouldRepeat,
  activeAyatNumber,
}: RepeatControlProps) => {
  return (
    <div className="flex gap-3 justify-between">
      <label className="flex gap-2" htmlFor="shouldRepeat">
        <input
          type="checkbox"
          name="shouldRepeat"
          id="shouldRepeat"
          checked={shouldRepeat}
          onChange={() => setShouldRepeat(!shouldRepeat)}
        />
        Repeat
      </label>
      <div>Current ayat #{activeAyatNumber}</div>
    </div>
  );
};

export default RepeatControl;

