import * as cheerio from 'cheerio';

export interface ScrapedWebsiteData {
  html: string;
  textContent: string;
  title: string;
  description: string;
  ogImage?: string;
  favicon?: string;
  url: string;
  themeColor?: string;
  fonts: string[];
  cssVariables: Record<string, string>;
  metaTags: Record<string, string>;
}

/**
 * Scrape website metadata and content
 */
export async function scrapeWebsite(url: string): Promise<ScrapedWebsiteData> {
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
    }

    // Fetch the website
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MagicSyncBot/1.0)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      '';

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    const ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    // Extract favicon
    let favicon =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href') ||
      '/favicon.ico';

    // Convert relative URLs to absolute
    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, url).href;
    }

    let absoluteOgImage = ogImage;
    if (ogImage && !ogImage.startsWith('http')) {
      absoluteOgImage = new URL(ogImage, url).href;
    }

    const themeColor = $('meta[name="theme-color"]').attr('content') || $('meta[name="msapplication-TileColor"]').attr('content');

    const fonts: string[] = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) fonts.push(href.startsWith('http') ? href : new URL(href, url).href);
    });
    $('style').each((_, el) => {
      const text = $(el).text();
      const fontFaceUrls = text.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
      if (fontFaceUrls) fonts.push(...fontFaceUrls);
    });

    const cssVariables: Record<string, string> = {};
    $('style').each((_, el) => {
      const text = $(el).text();
      const varMatches = text.matchAll(/--[\w-]+:\s*([^;]+)/g);
      for (const match of varMatches) {
        const fullMatch = match[0].trim();
        const parts = fullMatch.split(':');
        const varName = parts[0].trim();
        const varValue = parts.slice(1).join(':').trim();
        if (varName && varValue) cssVariables[varName] = varValue;
      }
    });
    $('[style]').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const varMatches = style.matchAll(/--[\w-]+:\s*([^;]+)/g);
        for (const match of varMatches) {
          const fullMatch = match[0].trim();
          const parts = fullMatch.split(':');
          const varName = parts[0].trim();
          const varValue = parts.slice(1).join(':').trim();
          if (varName && varValue) cssVariables[varName] = varValue;
        }
      }
    });

    const metaTags: Record<string, string> = {};
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property') || '';
      const content = $(el).attr('content') || '';
      if (name && content) metaTags[name] = content;
    });

    const $text = cheerio.load(html);
    $text('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement').remove();
    const articleSelectors = ['article', '[role="main"]', 'main', '.post-content', '.article-content', '.entry-content', '.content', '#content', '.post', '.article'];
    let textContent = '';
    for (const selector of articleSelectors) {
      const element = $text(selector);
      if (element.length > 0) {
        textContent = element.text();
        break;
      }
    }
    if (!textContent) textContent = $text('body').text();
    textContent = textContent.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim().substring(0, 10000);

    return {
      html,
      textContent,
      title: title.trim(),
      description: description.trim(),
      ogImage: absoluteOgImage,
      favicon,
      url,
      themeColor,
      fonts,
      cssVariables,
      metaTags,
    };
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download image from URL and return as buffer
 */
export async function downloadImage(imageUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MagicSyncBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Image download error:', error);
    throw new Error('Failed to download image');
  }
}

export interface ExtractedContent {
  title: string;
  content: string;
  description: string;
  url: string;
}
export async function renderHtml(html: string, options?: Record<string, unknown>){
  const $ = cheerio.load(html, options);
  return $;
}

export async function extractMainContent(url: string): Promise<ExtractedContent> {
  try {
    const scraped = await scrapeWebsite(url);
    return {
      title: scraped.title,
      content: scraped.textContent,
      description: scraped.description,
      url: scraped.url,
    };
  } catch (error) {
    console.error('Content extraction error:', error);
    throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

