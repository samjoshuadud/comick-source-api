import { FrontpageInfo } from "@/types";
import { BaseFrontpage } from "./base";
import { ComixFrontpage } from "./comix";
import { AsuraScanFrontpage } from "./asurascan";
import { MangaReadFrontpage } from "./mangaread";
import { MangaCloudFrontpage } from "./mangacloud";

const frontpages: BaseFrontpage[] = [
  new ComixFrontpage(),
  new AsuraScanFrontpage(),
  new MangaReadFrontpage(),
  new MangaCloudFrontpage(),
];

export function getFrontpage(sourceId: string): BaseFrontpage | null {
  return (
    frontpages.find(
      (fp) => fp.getSourceId().toLowerCase() === sourceId.toLowerCase()
    ) || null
  );
}

export function getAllFrontpages(): BaseFrontpage[] {
  return frontpages;
}

export function getAllFrontpageInfo(): FrontpageInfo[] {
  return frontpages.map((fp) => fp.getInfo());
}

export function getFrontpageSourceIds(): string[] {
  return frontpages.map((fp) => fp.getSourceId());
}

export { BaseFrontpage } from "./base";
export { ComixFrontpage } from "./comix";
export { AsuraScanFrontpage } from "./asurascan";
export { MangaReadFrontpage } from "./mangaread";
export { MangaCloudFrontpage } from "./mangacloud";
