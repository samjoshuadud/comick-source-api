/* eslint-disable @typescript-eslint/no-explicit-any */
import { FrontpageManga, FrontpageSection } from "@/types";
import {
  BaseFrontpage,
  FrontpageSectionConfig,
  FrontpageFetchOptions,
} from "./base";

export class MangaCloudFrontpage extends BaseFrontpage {
  private readonly BASE_URL = "https://mangacloud.org";
  private readonly API_URL = "https://api.mangacloud.org";

  getSourceId(): string {
    return "mangacloud";
  }

  getSourceName(): string {
    return "MangaCloud";
  }

  getAvailableSections(): FrontpageSectionConfig[] {
    return [
      {
        id: "latest_hot",
        title: "Latest Updates",
        type: "latest_hot",
        supportsPagination: true,
        supportsTimeFilter: false,
      },
    ];
  }

  async fetchSection(
    sectionId: string,
    options: FrontpageFetchOptions = {}
  ): Promise<FrontpageSection> {
    const { page = 1, limit = 48 } = options;
    
    try {
      // MangaCloud uses API: /comic/browse
      const response = await fetch(`${this.API_URL}/comic/browse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
          "Origin": this.BASE_URL,
          "Referer": `${this.BASE_URL}/`,
        },
        body: JSON.stringify({ 
          page, 
          limit,
          order: "update" 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const items: FrontpageManga[] = [];

      if (data.data && Array.isArray(data.data)) {
        for (const manga of data.data) {
          const comicId = manga.id;
          let coverImage: string | undefined;
          if (manga.cover && manga.cover.id && manga.cover.f) {
            coverImage = `https://meo3.comick.pictures/${manga.cover.id}.${manga.cover.f}`;
          }

          items.push({
            id: comicId.toString(),
            title: manga.title || "",
            url: `${this.BASE_URL}/comic/${comicId}`,
            coverImage,
            status: "ongoing",
          });
        }
      }

      return {
        id: "latest_hot",
        title: "Latest Updates",
        type: "latest_hot",
        items,
        supportsPagination: true,
        supportsTimeFilter: false,
      };
    } catch (error) {
      console.error("[MangaCloudFrontpage] Error:", error);
      throw error;
    }
  }
}
