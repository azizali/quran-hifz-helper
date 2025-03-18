import { useStore } from "@nanostores/react";
import React, { useEffect } from "react";
import {
  activePageNumber as activePageNumberStore,
  activeTrack,
  selectedMufhas
} from "../_main/sharedState";
import { parseSurahAyatFromTrack } from "../_main/utils";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "./ui/carousel";

const Page: React.FC = () => {
  const $activeTrack = useStore(activeTrack);
  const $selectedMufhas = useStore(selectedMufhas);
  const $activePageNumber = useStore(activePageNumberStore);
  const lastPageNumber = $selectedMufhas.totalPages;

  const [api, setApi] = React.useState<CarouselApi>()

  useEffect(() => {
    if (!api) {
      return
    }
    // Set the initial page number based on $activePageNumber
    api.scrollTo($activePageNumber - 1, true)

    activePageNumberStore.set(api.selectedScrollSnap() + 1)

    api.on("select", () => {
      activePageNumberStore.set(api.selectedScrollSnap() + 1)
    })
  }, [api, $activePageNumber])

  return (
    <Carousel dir="rtl" setApi={setApi} opts={{ direction: "rtl"}} className="z-5">
      <CarouselContent>
        {Array.from({ length: lastPageNumber }, (_, i) => i + 1).map((pageNumber) => (
          <CarouselItem key={pageNumber}>
            <img
              src={`${$selectedMufhas.urlPath}/${pageNumber}.png`}
              alt={`Page number: ${pageNumber}`}
              className="h-full"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};

export default Page;
