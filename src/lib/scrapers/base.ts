import { ScrapedChapter, ScrapedMangaDetails, SearchResult, SourceType } from "@/types";
import * as cheerio from "cheerio";

interface ScraperConfig {
  retryAttempts: number;
  downloadDelay: number;
  userAgent: string;
}

export interface ChapterPage {
  url: string;
  index: number;
  headers?: Record<string, string>;
}

export abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      retryAttempts: 3,
      downloadDelay: 1000,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      ...config,
    };
  }

  abstract getName(): string;
  abstract getBaseUrl(): string;
  abstract canHandle(url: string): boolean;
  abstract extractMangaInfo(
    url: string,
  ): Promise<{ title: string; id: string }>;
  abstract getChapterList(mangaUrl: string): Promise<ScrapedChapter[]>;
  abstract search(query: string): Promise<SearchResult[]>;

  async getMangaDetails(mangaUrl: string): Promise<ScrapedMangaDetails> {
    const info = await this.extractMangaInfo(mangaUrl);
    try {
      const html = await this.fetchWithRetry(mangaUrl);
      const $ = cheerio.load(html);

      const title =
        $("h1").first().text().trim() ||
        $('meta[property="og:title"]').attr("content")?.trim() ||
        info.title;

      const description =
        $('meta[property="og:description"]').attr("content")?.trim() ||
        $('meta[name="description"]').attr("content")?.trim() ||
        $(".summary__content, .description-summary, .entry-content").first().text().trim() ||
        undefined;

      const coverImage =
        $('meta[property="og:image"]').attr("content")?.trim() ||
        $('meta[name="twitter:image"]').attr("content")?.trim() ||
        $(".summary_image img, .thumb img, .post-thumbnail img").first().attr("src")?.trim() ||
        undefined;

      const author =
        $(".author-content a, .summary-content a").first().text().trim() ||
        undefined;
      const artist =
        $(".artist-content a").first().text().trim() ||
        undefined;

      return {
        title,
        id: info.id,
        description,
        coverImage,
        author,
        artist,
      };
    } catch {
      // Fall back to minimal metadata if HTML metadata extraction is unavailable.
    }

    return {
      title: info.title,
      id: info.id,
    };
  }
  
  // Get chapter page images - override in scrapers that support it
  async getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
    void chapterUrl;
    throw new Error(`${this.getName()} does not support chapter page scraping yet`);
  }

  protected async fetchWithRetry(
    url: string,
    retries = this.config.retryAttempts,
  ): Promise<string> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": this.config.userAgent,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            DNT: "1",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        if (i === retries) {
          throw error;
        }
        await this.delay(this.config.downloadDelay * (i + 1));
      }
    }
    throw new Error("Failed to fetch after retries");
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected extractChapterNumber(chapterUrl: string): number {
    const match = chapterUrl.match(/chapter[/-](\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  protected sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]/g, "_").trim();
  }

  getDescription(): string {
    return `${this.getName()} - ${this.getBaseUrl()}`;
  }

  isClientOnly(): boolean {
    return false;
  }

  getType(): SourceType {
    return "aggregator";
  }
  
  // Check if this scraper supports page scraping
  supportsPageScraping(): boolean {
    return false;
  }
}
