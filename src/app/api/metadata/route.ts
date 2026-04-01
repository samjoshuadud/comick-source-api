import { NextRequest, NextResponse } from "next/server";
import { getScraperByName } from "@/lib/scrapers";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { url, source } = await request.json();
    if (!url || !source) {
      return NextResponse.json(
        { error: "Missing required fields: url and source" },
        { status: 400 },
      );
    }

    const scraper = getScraperByName(source);
    if (!scraper) {
      return NextResponse.json(
        { error: `Unknown source: ${source}` },
        { status: 400 },
      );
    }

    const details = await scraper.getMangaDetails(url);
    return NextResponse.json({
      source: scraper.getName(),
      url,
      details,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch metadata",
      },
      { status: 500 },
    );
  }
}

