/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { BaseScraper, ChapterPage } from "./base";
import { ScrapedChapter, SearchResult, SourceType } from "@/types";

export class AsuraScanScraper extends BaseScraper {
  private readonly BASE_URL = "https://asurascans.com";

  protected override async fetchWithRetry(url: string): Promise<string> {
    // Direct fetch with proper headers (works in edge runtime)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://asurascans.com/",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  getName(): string {
    return "AsuraScan";
  }

  getBaseUrl(): string {
    return this.BASE_URL;
  }

  canHandle(url: string): boolean {
    return url.includes("asurascans.com") || url.includes("asuracomic.net");
  }

  isClientOnly(): boolean {
    return true;
  }

  getType(): SourceType {
    return "scanlator";
  }

  async search(query: string): Promise<SearchResult[]> {
    const searchUrl = `${this.BASE_URL}/browse?search=${encodeURIComponent(query)}`;
    const html = await this.fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".series-card").each((_, element) => {
      const $card = $(element);

      const $link = $card.find('a[href^="/comics/"]').first();
      const href = $link.attr("href");
      if (!href) return;

      const slugMatch = href.match(/\/comics\/([^/?]+)/);
      const id = slugMatch ? slugMatch[1] : "";

      const title = $card.find("h3").first().text().trim();
      if (!title) return;

      const coverImg = $card.find("img").first();
      const coverImage = coverImg.attr("src") || coverImg.attr("data-src");

      const chapterSpans = $card.find("span.text-xs.font-medium");
      let latestChapter = 0;
      chapterSpans.each((_, span) => {
        const text = $(span).text().trim();
        const chapterMatch = text.match(/^(\d+)\s+(Chs\.|Chapters?)$/i);
        if (chapterMatch) {
          latestChapter = parseInt(chapterMatch[1], 10);
        }
      });

      const ratingSpan = $card.find("span.text-\\[10px\\]").first();
      const rating = ratingSpan.length
        ? parseFloat(ratingSpan.text().trim())
        : undefined;

      const fullUrl = `${this.BASE_URL}${href}`;

      results.push({
        id,
        title,
        url: fullUrl,
        coverImage: coverImage?.startsWith("http")
          ? coverImage
          : coverImage
            ? `${this.BASE_URL}${coverImage}`
            : undefined,
        latestChapter,
        lastUpdated: "",
        rating,
      });
    });

    return results;
  }

  async extractMangaInfo(url: string): Promise<{ title: string; id: string }> {
    const html = await this.fetchWithRetry(url);
    const $ = cheerio.load(html);

    let title = $("h1").first().text().trim();

    if (!title) {
      title = $("h2").first().text().trim();
    }

    if (!title) {
      title = $("h3").first().text().trim();
    }

    if (!title) {
      const pageTitle = $("title").text();
      title = pageTitle.split(" - ")[0].split("|")[0].trim();
    }

    const urlMatch = url.match(/\/(?:comics|series)\/([^/?]+)/);
    const id = urlMatch ? urlMatch[1] : Date.now().toString();

    return { title, id };
  }

  async getChapterList(mangaUrl: string): Promise<ScrapedChapter[]> {
    if (!mangaUrl || !mangaUrl.startsWith('http')) {
      throw new Error(`Invalid manga URL: ${mangaUrl}`);
    }
    const html = await this.fetchWithRetry(mangaUrl);
    const $ = cheerio.load(html);
    const chapters: ScrapedChapter[] = [];
    const seenChapterNumbers = new Set<number>();

    const chapterLinks = $('a[href*="/chapter/"]');

    chapterLinks.each((_: number, element: any) => {
      const $link = $(element);
      let href = $link.attr("href");

      if (!href) {
        return;
      }

      const chapterText =
        $link.find("span.font-medium").first().text().trim() ||
        $link.find("h3").first().text().trim();

      href = href.trim();

      let fullUrl: string;
      if (href.startsWith("http")) {
        fullUrl = href;
      } else if (href.startsWith("/")) {
        fullUrl = `${this.BASE_URL}${href}`;
      } else {
        // If it's a relative path from the comics page
        if (mangaUrl.includes("/comics/")) {
            fullUrl = `${mangaUrl.endsWith('/') ? mangaUrl : mangaUrl + '/'}${href}`;
        } else {
            fullUrl = `${this.BASE_URL}/comics/${href}`;
        }
      }

      const chapterNumber = this.extractChapterNumber(fullUrl, chapterText);

      if (chapterNumber >= 0 && !seenChapterNumbers.has(chapterNumber)) {
        seenChapterNumbers.add(chapterNumber);
        chapters.push({
          id: `${chapterNumber}`,
          number: chapterNumber,
          title: chapterText,
          url: fullUrl,
        });
      }
    });

    return chapters.sort((a, b) => a.number - b.number);
  }

  protected override extractChapterNumber(chapterUrl: string, chapterText?: string): number {
    if (chapterText) {
      // Match concatenated chapters like "Chapter 5 + 6" or "Chapter 5 - 6"
      // But NOT "Chapter 34 - 11.Grand Forge" where the number after dash is a section title
      // The difference: concatenated chapters don't have a period after the second number
      const concatenatedMatch = chapterText.match(/Chapter\s+(\d+)\s*[\+\-]\s*(\d+)(?!\.)(?:\s*$|\s+[^0-9])/i);
      if (concatenatedMatch) {
        return -1;
      }

      const textMatch = chapterText.match(/Chapter\s+(\d+(?:\.\d+)?)/i);
      if (textMatch) {
        return parseFloat(textMatch[1]);
      }
    }

    const patterns = [
      /\/chapter\/(\d+)(?:[.-](\d+))?/i,
      /chapter[/-](\d+)(?:[.-](\d+))?$/i,
    ];

    for (const pattern of patterns) {
      const match = chapterUrl.match(pattern);
      if (match) {
        const mainNumber = parseInt(match[1], 10);
        const decimalPart = match[2] ? match[2] : null;

        if (decimalPart) {
          const divisor = Math.pow(10, decimalPart.length);
          return mainNumber + parseInt(decimalPart, 10) / divisor;
        }
        return mainNumber;
      }
    }

    return -1;
  }

  override supportsPageScraping(): boolean {
    return true;
  }

  async getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
    const html = await this.fetchWithRetry(chapterUrl);
    const $ = cheerio.load(html);
    const pages: ChapterPage[] = [];

    const addPage = (url: string) => {
      const cleanUrl = url.replace(/\\/g, "").trim();
      if (
        cleanUrl.startsWith("http") &&
        cleanUrl.includes("/chapters/") &&
        !cleanUrl.includes("logo") &&
        !cleanUrl.includes("avatar") &&
        !pages.find((p) => p.url === cleanUrl)
      ) {
        pages.push({
          url: cleanUrl,
          index: pages.length,
          headers: { Referer: this.BASE_URL },
        });
      }
    };

    // Strategy 1: Astro Island props (current AsuraScan DOM as of 2026)
    // AsuraScan uses Astro framework. Chapter data is embedded in
    // <astro-island props="..."> with HTML-entity-encoded JSON.
    $("astro-island").each((_, el) => {
      const propsAttr = $(el).attr("props");
      if (!propsAttr || !propsAttr.includes("pages")) return;

      // Decode HTML entities in the attribute value
      const decoded = propsAttr
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'");

      // Extract all image URLs from the decoded props string
      const urlRegex =
        /https?:\/\/(?:cdn\.asurascans\.com|asuracomic\.net)\/[^"\s]+\.(?:webp|jpg|png|jpeg)/g;
      const matches = decoded.match(urlRegex);
      if (matches) {
        matches.forEach((url) => addPage(url));
      }
    });

    if (pages.length >= 3) {
      return this.sortAndDedupPages(pages);
    }

    // Strategy 2: __NEXT_DATA__ JSON (legacy, kept as fallback)
    const findImagesRecursively = (obj: any): string[] => {
      let results: string[] = [];
      if (!obj || typeof obj !== "object") return results;

      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (
            typeof item === "string" &&
            (item.includes("/chapters/") ||
              item.includes("cdn.asurascans.com"))
          ) {
            results.push(item);
          } else {
            results = results.concat(findImagesRecursively(item));
          }
        }
      } else {
        for (const key in obj) {
          if (
            ["pages", "images", "urls", "chapter"].includes(key.toLowerCase())
          ) {
            const val = obj[key];
            if (Array.isArray(val)) {
              val.forEach((item: any) => {
                const url =
                  typeof item === "string" ? item : item.url || item.src;
                if (
                  url &&
                  typeof url === "string" &&
                  (url.includes("/chapters/") ||
                    url.includes("cdn.asurascans.com"))
                ) {
                  results.push(url);
                }
              });
            }
          }
          results = results.concat(findImagesRecursively(obj[key]));
        }
      }
      return results;
    };

    const nextData = $("#__NEXT_DATA__").html();
    if (nextData) {
      try {
        const jsonData = JSON.parse(nextData);
        const foundUrls = findImagesRecursively(jsonData);
        foundUrls.forEach((url) => addPage(url));
      } catch (e) {
        console.error("[AsuraScan] __NEXT_DATA__ parse failed:", e);
      }
    }

    if (pages.length >= 3) {
      return this.sortAndDedupPages(pages);
    }

    // Strategy 3: Global regex on raw HTML (last-resort fallback)
    const rawHtml = $.html();
    const globalRegex =
      /https?:\/\/(?:cdn\.asurascans\.com|asuracomic\.net)\/asura-images\/chapters\/[^\s"'}]+(?:\.webp|\.jpg|\.png|\.jpeg)/g;
    const matches = rawHtml.match(globalRegex);
    if (matches) {
      matches.forEach((url) => addPage(url));
    }

    return this.sortAndDedupPages(pages);
  }

  private sortAndDedupPages(pages: ChapterPage[]): ChapterPage[] {
    return pages
      .sort((a, b) => {
        const getPageNum = (url: string) => {
          const m = url.match(/(\d+)\.(?:webp|jpg|png|jpeg)$/i);
          return m ? parseInt(m[1], 10) : 0;
        };
        return getPageNum(a.url) - getPageNum(b.url) || a.index - b.index;
      })
      .filter(
        (page, index, self) =>
          index === self.findIndex((t) => t.url === page.url)
      )
      .map((page, index) => ({ ...page, index }));
  }
}
