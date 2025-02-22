import { useStore } from "@nanostores/react";
import React from "react";
import { activeTrack } from "../_main/sharedState";
import { surahAyatToPage } from "../_main/surahAyatToPage";
import { parseSurahAyatFromTrack } from "../_main/utils";

const Page: React.FC = () => {
  const $activeTrack = useStore(activeTrack);
  console.log({ $activeTrack, activeTrack });
  const { surah, ayat } = parseSurahAyatFromTrack($activeTrack);
  console.log("out", { surah, ayat });

  const pageNumber = surahAyatToPage[surah]?.[ayat] || 1;

  // return <div className="border border-red-500">a{$activeTrack}z</div>;
  return (
    <div className="flex justify-center h-screen">
      <img
        src={`images/${pageNumber}.jpg`}
        alt={`Page number: ${pageNumber}`}
        className="h-full"
      />
    </div>
  );
};

export default Page;
