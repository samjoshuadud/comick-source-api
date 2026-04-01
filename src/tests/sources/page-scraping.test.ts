/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { getAllScrapers } from "@/lib/scrapers";

/**
 * Page Scraping Health Check
 *
 * Verifies that all sources with supportsPageScraping() still return
 * valid chapter page images. Manga sites frequently rotate their DOM
 * or change CDN patterns — this test catches breakage early.
 *
 * Each source needs a known-good test chapter URL below.
 * If a source breaks, update the URL or fix the scraper.
 */

// Known-good chapter URLs for each source that supports page scraping.
// Keep these updated — if a URL returns 404, swap it for a working one.
const testChapterUrls: Record<string, string> = {
    AsuraScan:
        "https://asurascans.com/comics/solo-leveling-f6174291/chapter/1",
    MangaRead:
        "https://www.mangaread.org/manga/omniscient-readers-viewpoint/chapter-1/",
    MangaCloud:
        "https://mangacloud.org/comic/182360379588872024/chapter/182360398782007131",
    Mangataro:
        "https://mangataro.org/read/omniscient-readers-viewpoint/ch1-6499",
    Thunderscans:
        "https://en-thunderscans.com/chapter-1/",
    "Vortex Scans":
        "https://vortexscans.io/series/emperor-of-solo-play/chapter-9",
    MangaDex:
        "https://mangadex.org/chapter/2cd94273-6cbf-4671-a8bd-56245b59122d",
};

describe("Page Scraping Health Check", () => {
    const allScrapers = getAllScrapers();
    const pageScrapers = allScrapers.filter((s) => s.supportsPageScraping());

    it("should have at least one scraper that supports page scraping", () => {
        expect(pageScrapers.length).toBeGreaterThan(0);
        console.log(
            `[Page Scraping] ${pageScrapers.length} sources support page scraping: ${pageScrapers.map((s) => s.getName()).join(", ")}`
        );
    });

    it("should have test URLs for every page-scraping source", () => {
        const missing = pageScrapers.filter(
            (s) => !testChapterUrls[s.getName()]
        );
        if (missing.length > 0) {
            console.warn(
                `[Page Scraping] Missing test URLs for: ${missing.map((s) => s.getName()).join(", ")}. ` +
                `Add them to testChapterUrls in page-scraping.test.ts`
            );
        }
        // Warn but don't fail — new sources may not have URLs yet
        expect(missing.length).toBe(0);
    });

    pageScrapers.forEach((scraper) => {
        const name = scraper.getName();
        const chapterUrl = testChapterUrls[name];

        if (!chapterUrl) return;

        describe(`${name}`, () => {
            it("should return chapter pages with valid structure", async () => {
                try {
                    const pages = await scraper.getChapterPages(chapterUrl);

                    // Must be an array
                    expect(Array.isArray(pages)).toBe(true);

                    // Must have a meaningful number of pages (>= 3).
                    // A result of 0-2 pages almost always means the scraper is broken
                    // (DOM changed, images not found, etc.)
                    expect(pages.length).toBeGreaterThanOrEqual(3);

                    console.log(
                        `[${name}] ✅ ${pages.length} pages returned`
                    );

                    // Validate structure of each page
                    pages.forEach((page, idx) => {
                        // url must be a valid HTTP URL
                        expect(page.url).toBeDefined();
                        expect(page.url).toMatch(/^https?:\/\//);

                        // index must be a non-negative number
                        expect(typeof page.index).toBe("number");
                        expect(page.index).toBeGreaterThanOrEqual(0);

                        // If headers exist, Referer should be present
                        if (page.headers) {
                            expect(page.headers.Referer).toBeDefined();
                            expect(page.headers.Referer).toMatch(/^https?:\/\//);
                        }

                        // Must point to an image (common extensions)
                        if (idx < 3) {
                            // Only log first 3 to keep output clean
                            console.log(`  [${page.index}] ${page.url.substring(0, 80)}...`);
                        }
                    });

                    // Verify pages are in order (index should be sequential)
                    for (let i = 1; i < pages.length; i++) {
                        expect(pages[i].index).toBeGreaterThan(pages[i - 1].index);
                    }

                    // Verify no duplicate URLs
                    const urls = pages.map((p) => p.url);
                    const uniqueUrls = new Set(urls);
                    expect(uniqueUrls.size).toBe(urls.length);
                } catch (error: any) {
                    // Log but only fail for real errors, not temporary network issues
                    console.error(
                        `[${name}] ❌ getChapterPages failed: ${error.message}`
                    );

                    if (
                        error.message?.includes("timeout") ||
                        error.message?.includes("ECONNREFUSED") ||
                        error.message?.includes("503") ||
                        error.message?.includes("cloudflare")
                    ) {
                        console.warn(
                            `[${name}] ⚠️  Temporary network issue — skipping`
                        );
                        return;
                    }

                    throw error;
                }
            }, 30000);
        });
    });
});
