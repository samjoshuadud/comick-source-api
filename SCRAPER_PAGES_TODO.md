# Scraper getChapterPages Implementation TODO

This document tracks which scrapers need `getChapterPages()` implementation for extracting manga page images.

## ✅ Implemented (7/60+)

- [x] **AsuraScan** - Uses CDN images from `cdn.asurascans.com/asura-images/chapters/`
- [x] **MangaRead** - WordPress-based, uses `wp-manga-chapter-img` class
- [x] **MangaCloud** - Has API endpoint for chapter images
- [x] **Mangataro** - Has API endpoint `auth/chapter-content` for chapter images (CDN: mangataro.yachts)
- [x] **Thunderscans** - Reader payload includes `ts_reader.run({... sources[].images ...})`
- [x] **Vortex Scans** - Reader HTML includes `storage.vortexscans.io` chapter image URLs
- [x] **MangaDex** - Uses official MangaDex At-Home API (`/at-home/server/{chapterId}`)

## 🔔 Current Verification Scope Reminder

End-to-end verification covers the implemented sources above (except sources currently blocked by Cloudflare in server runtime).

- Backend `/api/pages` supports: `AsuraScan`, `MangaRead`, `MangaCloud`, `Mangataro`, `Thunderscans`, `Vortex Scans`, `MangaDex`
- Chapter list/page flows should be tested with `source` query/body set to one of those sources
- Other scrapers must stay in TODO state until their `getChapterPages()` is implemented

When adding new sources later:
1. Implement `getChapterPages()` in scraper
2. Override `supportsPageScraping(): true`
3. Verify `search -> chapters -> pages` flow
4. Add source to backend verification scope
5. Add test chapter URL to `page-scraping.test.ts`

## 🖥️ Reader UI Integration (Completed)

The multi-source tracking and reader UI is integrated into the primary Next.js frontend (`partyhwa/frontend`) and Go backend (`partyhwa/backend`):
1. **API Fallbacks**: Go backend aggregates multi-source NDJSON streams into the unified `/api/manga` discovery lists.
2. **Title Normalization**: Frontend fuzzy-matches titles (stripping punctuation and `(Manhwa)` tags) to group the exact same manga across different sources.
3. **Source Picker**: Frontend dynamically queries alternative sources when viewing a manga and provides a seamless UI to switch the active reading source.


## 🔄 High Priority (Popular sources with good results)

- [ ] **FlameComics** - Next.js based, needs investigation for image loading
- [ ] **MangaKatana** - Uses JavaScript encoded image URLs (var ytaw)
- [ ] **Mgeko** - Need to verify working chapter URLs (was returning 404)
- [ ] **Manhuaplus** - Need to find image pattern in reader
- [ ] **WeebCentral** - Client-only scraper, reader structure investigation needed
- [x] **Vortex Scans** - Returned good results in search
- [ ] **Raven Scans** - WordPress-based manga reader
- [ ] **WEBTOON** - Official platform, different structure
- [ ] **AtsuMoe** - Custom reader implementation needed
- [ ] **KaliScan** - Uses CDN image URLs
- [ ] **DemonicScans** - Custom manga reader
- [ ] **Comix** - Has API but Cloudflare protected
- [ ] **MangaPark** - Custom reader structure

## 📋 Medium Priority

- [ ] **Stonescape**
- [ ] **Project Suki**
- [ ] **Mangaloom**
- [ ] **Diva Scans**
- [ ] **Greed Scans**
- [ ] **Kenscans**
- [ ] **Mangayy**

## 🔧 Technical Notes

### Image Loading Patterns Found:

1. **Direct IMG tags with src/data-src**
   - MangaRead: `<img class="wp-manga-chapter-img" src="...">`
   - Pattern: `$("img.wp-manga-chapter-img")`

2. **CDN-based images**
   - AsuraScan: `cdn.asurascans.com/asura-images/chapters/{manga}/{chapter}/{page}.webp`
   - Pattern: `$('img[src*="cdn.asurascans.com"]')`

3. **API-based**
   - MangaCloud: `api.mangacloud.org/chapter/{id}` returns JSON with image array
   - Comix: `api.comix.to/v2/...` (Cloudflare protected)

4. **JavaScript Variables**
   - MangaKatana: `var ytaw=['url1', 'url2']` with encoded URLs
   - Need to extract and decode

5. **Lazy Loading**
   - Many use `data-src`, `data-lazy-src`, `data-original` attributes
   - Check multiple attributes per image

### Common Headers Needed:

```javascript
{
  "Referer": "{source-base-url}",
  "User-Agent": "Mozilla/5.0...",
}
```

### Testing Strategy:

For each scraper:
1. Find a working manga (e.g., "Solo Leveling")
2. Get chapter list
3. Pick chapter 1
4. Inspect HTML/API for image URLs
5. Test if images load with proper headers
6. Implement `getChapterPages()` method

### Automated Health Test:

All implemented sources are continuously validated via:

```bash
npx vitest run src/tests/sources/page-scraping.test.ts
```

This test auto-discovers scrapers with `supportsPageScraping()` and checks:
- Returns ≥3 pages (catches broken DOM / empty responses)
- Valid HTTP image URLs, sequential indices, no duplicates
- Proper `Referer` headers

When adding a new source, add its test chapter URL to `testChapterUrls` in `page-scraping.test.ts`.

## 📝 Implementation Template

```typescript
async getChapterPages(chapterUrl: string): Promise<ChapterPage[]> {
  const html = await this.fetchWithRetry(chapterUrl);
  const $ = cheerio.load(html);
  const pages: ChapterPage[] = [];

  // Find images - adjust selector per source
  $("img.chapter-img").each((index, element) => {
    const src = $(element).attr("data-src") || $(element).attr("src");
    
    if (src) {
      pages.push({
        url: src,
        index,
        headers: {
          Referer: this.getBaseUrl(),
        },
      });
    }
  });

  return pages.sort((a, b) => a.index - b.index);
}
```

## 🚫 Known Issues

- **Comix**: Cloudflare protection blocks API access from server
- **Mgeko**: Some chapter URLs return 404
- **FlameComics**: Next.js SSR may require different approach
- **WeebCentral**: Marked as client-only scraper

## 📊 Progress Tracking

Total Scrapers: ~60+  
Implemented: 4  
Percentage: ~7%

**Next Milestone**: Get 10 popular sources working (17%)
