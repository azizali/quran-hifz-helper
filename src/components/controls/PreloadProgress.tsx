type PreloadProgressProps = {
  loaded: number;
  total: number;
};

const PreloadProgress = ({ loaded, total }: PreloadProgressProps) => {
  if (total === 0 || loaded >= total) {
    return null;
  }

  return (
    <div className="px-4 pb-1">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(loaded / total) * 100}%` }}
          />
        </div>
        <span>Loading {loaded}/{total}</span>
      </div>
    </div>
  );
};

export default PreloadProgress;
