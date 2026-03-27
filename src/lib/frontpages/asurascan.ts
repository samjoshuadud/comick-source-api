/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { FrontpageManga, FrontpageSection } from "@/types";
import {
  BaseFrontpage,
  FrontpageSectionConfig,
  FrontpageFetchOptions,
} from "./base";

export class AsuraScanFrontpage extends BaseFrontpage {
  private readonly BASE_URL = "https://asurascans.com";

  getSourceId(): string {
    return "asurascan";
  }

  getSourceName(): string {
    return "AsuraScan";
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
    
    // Asura uses /browse?page=X&order=update
    const url = `${this.BASE_URL}/browse?page=${page}&order=update`;
    
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

      $(".series-card").each((_, element) => {
        const $card = $(element);
        const $link = $card.find('a[href^="/comics/"]').first();
        const href = $link.attr("href");
        if (!href) return;

        const title = $card.find("h3").first().text().trim();
        const coverImg = $card.find("img").first();
        const coverImage = coverImg.attr("src") || coverImg.attr("data-src");

        const ratingSpan = $card.find("span.text-\\[10px\\]").first();
        const rating = ratingSpan.length ? parseFloat(ratingSpan.text().trim()) : undefined;

        items.push({
          id: href.split("/").pop() || "",
          title,
          url: `${this.BASE_URL}${href}`,
          coverImage: coverImage?.startsWith("http") ? coverImage : `${this.BASE_URL}${coverImage}`,
          rating,
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
      console.error("[AsuraScanFrontpage] Error:", error);
      throw error;
    }
  }
}
