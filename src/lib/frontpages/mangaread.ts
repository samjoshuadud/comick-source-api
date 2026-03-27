/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { FrontpageManga, FrontpageSection } from "@/types";
import {
  BaseFrontpage,
  FrontpageSectionConfig,
  FrontpageFetchOptions,
} from "./base";

export class MangaReadFrontpage extends BaseFrontpage {
  private readonly BASE_URL = "https://www.mangaread.org";

  getSourceId(): string {
    return "mangaread";
  }

  getSourceName(): string {
    return "MangaRead";
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
    const { page = 1 } = options;
    
    // MangaRead (Madara theme) uses /manga/page/X/?m_orderby=latest
    const url = `${this.BASE_URL}/manga/page/${page}/?m_orderby=latest`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": this.BASE_URL,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const items: FrontpageManga[] = [];

      $(".manga-item, .page-item-detail").each((_, element) => {
        const $item = $(element);
        const $link = $item.find("h3 a, h4 a, .post-title a").first();
        const href = $link.attr("href");
        const title = $link.text().trim();

        if (!href) return;

        const coverImg = $item.find("img").first();
        const coverImage = coverImg.attr("data-src") || coverImg.attr("src");

        items.push({
          id: href.split("/").filter(Boolean).pop() || "",
          title,
          url: href,
          coverImage: coverImage?.startsWith("http") ? coverImage : `${this.BASE_URL}${coverImage}`,
          status: "ongoing",
        });
      });

      return {
        id: "latest_hot",
        title: "Latest Updates",
        type: "latest_hot",
        items,
        supportsPagination: true,
        supportsTimeFilter: false,
      };
    } catch (error) {
      console.error("[MangaReadFrontpage] Error:", error);
      throw error;
    }
  }
}
