/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseScraper, ChapterPage } from "./base";
import { ScrapedChapter, SearchResult, SourceType } from "@/types";

export class MangaDexScraper extends BaseScraper {
  private readonly BASE_URL = "https://mangadex.org";
  private readonly API_URL = "https://api.mangadex.org";
  private readonly COVERS_CDN = "https://uploads.mangadex.org/covers";

  getName(): string {
    return "MangaDex";
  }

  getBaseUrl(): string {
    return this.BASE_URL;
  }

  getType(): SourceType {
    return "aggregator";
  }

  canHandle(url: string): boolean {
    return (
      url.includes("mangadex.org/title/") ||
      url.includes("mangadex.org/chapter/") ||
      url.includes("api.mangadex.org")
    );
  }

  private parseMangaId(url: string): string {
    const match = url.match(/\/title\/([0-9a-f-]{36})/i);
    if (!match) {
      throw new Error("Invalid MangaDex manga URL");
    }
    return match[1];
  }

  private parseChapterId(url: string): string {
    const match = url.match(/\/chapter\/([0-9a-f-]{36})/i);
    if (!match) {
      throw new Error("Invalid MangaDex chapter URL");
    }
    return match[1];
  }

  private pickTitle(attributes: any): string {
    const titleObj = attributes?.title || {};
    return (
      titleObj.en ||
      Object.values(titleObj)[0] ||
      attributes?.altTitles?.find((x: any) => x.en)?.en ||
      "Untitled"
    ) as string;
  }

  async search(query: string): Promise<SearchResult[]> {
    const url = `${this.API_URL}/manga?title=${encodeURIComponent(query)}&limit=5&includes[]=cover_art&order[relevance]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&hasAvailableChapters=true`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.config.userAgent,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const mangas = Array.isArray(data?.data) ? data.data : [];

    return mangas.map((manga: any) => {
      const id = manga.id;
      const attrs = manga.attributes || {};
      const title = this.pickTitle(attrs);
      const coverRel = (manga.relationships || []).find(
        (r: any) => r.type === "cover_art",
      );
      const fileName = coverRel?.attributes?.fileName;
      const coverImage = fileName
        ? `${this.COVERS_CDN}/${id}/${fileName}.256.jpg`
        : undefined;

      return {
        id,
        title,
        url: `${this.BASE_URL}/title/${id}`,
        coverImage,
        latestChapter: 0,
        lastUpdated: attrs?.updatedAt
          ? new Date(attrs.updatedAt).toLocaleDateString()
          : "",
        lastUpdatedTimestamp: attrs?.updatedAt
          ? new Date(attrs.updatedAt).getTime()
          : undefined,
        rating: undefined,
      };
    });
  }

  async extractMangaInfo(url: string): Promise<{ title: string; id: string }> {
    const id = this.parseMangaId(url);
    const response = await fetch(`${this.API_URL}/manga/${id}`, {
      headers: {
        "User-Agent": this.config.userAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const title = this.pickTitle(data?.data?.attributes || {});
    return { title, id };
  }

  async getChapterList(mangaUrl: string): Promise<ScrapedChapter[]> {
    const mangaId = this.parseMangaId(mangaUrl);
    const url = `${this.API_URL}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.config.userAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = Array.isArray(data?.data) ? data.data : [];
    const seen = new Set<string>();
    const chapters: ScrapedChapter[] = [];

    for (const row of rows) {
      const chapterId = row.id;
      const attrs = row.attributes || {};
      const chapterRaw = attrs.chapter ?? "0";
      const key = `${chapterRaw}:${attrs.title || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const num = parseFloat(chapterRaw);
      chapters.push({
        id: chapterId,
        number: Number.isFinite(num) ? num : 0,
        title: attrs.title || undefined,
        url: `${this.BASE_URL}/chapter/${chapterId}`,
        lastUpdated: attrs.publishAt
          ? new Date(attrs.publishAt).toLocaleDateString()
          : undefined,
      });
    }

    return chapters.sort((a, b) => a.number - b.number);
  }

  override supportsPageScraping(): boolean {
    return true;
  }

  async getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
    const chapterId = this.parseChapterId(chapterUrl);
    const response = await fetch(`${this.API_URL}/at-home/server/${chapterId}`, {
      headers: {
        "User-Agent": this.config.userAgent,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const baseUrl = data?.baseUrl;
    const hash = data?.chapter?.hash;
    const files: string[] = data?.chapter?.data || [];
    if (!baseUrl || !hash || !Array.isArray(files) || files.length === 0) {
      throw new Error("Invalid MangaDex at-home response");
    }

    return files.map((file, index) => ({
      url: `${baseUrl}/data/${hash}/${file}`,
      index,
      headers: {
        Referer: this.BASE_URL,
      },
    }));
  }
}

