import { NextRequest, NextResponse } from 'next/server';
import { getScraperByName } from '@/lib/scrapers';

export const runtime = 'edge';

interface PageRequest {
  url: string;
  source: string;
}

interface ErrorWithMessage {
  message: string;
}

function hasMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: PageRequest = await request.json();
    const { url, source } = body;

    if (!url || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: url and source' },
        { status: 400 }
      );
    }

    // Get the appropriate scraper
    const scraper = getScraperByName(source);
    
    if (!scraper) {
      return NextResponse.json(
        { error: `Unknown source: ${source}` },
        { status: 400 }
      );
    }

    // Check if scraper supports page scraping
    if (!scraper.supportsPageScraping()) {
      return NextResponse.json(
        { 
          error: `Source ${source} does not support page scraping yet`,
          message: 'This scraper needs getChapterPages implementation'
        },
        { status: 501 }
      );
    }

    // Fetch chapter pages
    try {
      const pages = await scraper.getChapterPages(url);
      
      return NextResponse.json({
        source,
        url,
        pages,
        count: pages.length
      });
    } catch (scraperError: unknown) {
      console.error(`[${source}] Error fetching pages:`, scraperError);
      return NextResponse.json(
        { 
          error: `Failed to fetch pages from ${source}`,
          details: hasMessage(scraperError) ? scraperError.message : 'Unknown scraper error',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: hasMessage(error) ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
