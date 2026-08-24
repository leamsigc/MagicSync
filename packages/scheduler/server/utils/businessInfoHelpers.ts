/**
 * Helpers for AI business information extraction.
 *
 * Keeps the AI prompt small and fast by pre-filtering noise, and provides
 * deterministic brand data extracted directly from the scraped HTML so the
 * model does not have to restate values we already know.
 */

const RELEVANT_CSS_VAR_PATTERN =
  /(color|colour|bg|background|brand|primary|secondary|accent|tertiary|surface|foreground|font|text|heading|body|radius|spacing|space|gap|shadow|border)/i;

const MAX_CSS_VARS = 120;

interface ScrapedInput {
  fonts?: string[];
  cssVariables?: Record<string, string>;
  themeColor?: string;
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
  metaTags?: Record<string, string>;
}

/**
 * Reduce cssVariables down to brand-relevant tokens (colors, fonts, spacing).
 * Tailwind-style sites dump thousands of variables; sending them all slows the
 * model down without improving extraction quality.
 */
export function pickRelevantCssVariables(
  cssVariables: Record<string, string>
): Record<string, string> {
  const relevant: Record<string, string> = {};
  const keys = Object.keys(cssVariables);
  let included = 0;

  for (const key of keys) {
    if (!RELEVANT_CSS_VAR_PATTERN.test(key)) continue;
    if (included >= MAX_CSS_VARS) break;
    relevant[key] = cssVariables[key];
    included++;
  }

  return relevant;
}

/**
 * Extract real font-family names from stylesheet/font URLs
 * (e.g. Google Fonts links contain `family=Inter:wght@400;700`).
 */
export function extractFontFamilies(fonts: string[]): string[] {
  const families = new Set<string>();

  for (const fontUrl of fonts) {
    // Google Fonts style URLs
    const googleMatch = fontUrl.match(/family=([^&:]+)/g);
    if (googleMatch?.length) {
      for (const m of googleMatch) {
        const family = decodeURIComponent(m.replace('family=', '')).replace(/\+/g, ' ').trim();
        if (family) families.add(family);
      }
      continue;
    }

    // Font file URLs: inter-latin-400.woff2 / Inter-Bold.ttf
    const fileMatch = fontUrl.match(/\/([\w-]+)\.(woff2?|ttf|otf)(\?|$)/i);
    if (fileMatch) {
      const family = fileMatch[1]
        .replace(/-(latin|latin-ext|cyrillic|greek|vietnamese|ext).*$/i, '')
        .replace(/[-_](\d+|regular|bold|italic|light|medium|semibold|extrabold|black|thin)$/gi, '')
        .replace(/[-_]/g, ' ')
        .trim();
      if (family.length > 2) families.add(family);
    }
  }

  return [...families].slice(0, 12);
}

export interface DeterministicBrandData {
  colorScheme?: string;
  colors?: Record<string, string>;
  typography?: Record<string, string>;
  spacing?: Record<string, unknown>;
  components?: Record<string, unknown>;
  images?: Record<string, unknown>;
  personality?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  metadata?: Record<string, string>;
  fonts?: string[];
}

/**
 * Build brand data deterministically from the scrape result. These values are
 * facts observed on the page and should always win over model inference.
 */
export function buildDeterministicBrandData(
  websiteData: ScrapedInput
): DeterministicBrandData {
  const fonts = extractFontFamilies(websiteData.fonts || []);
  const relevantVars = pickRelevantCssVariables(websiteData.cssVariables || {});

  const colors: Record<string, string> = {};
  if (websiteData.themeColor) colors.primary = websiteData.themeColor;

  for (const [key, value] of Object.entries(relevantVars)) {
    if (Object.keys(colors).length >= 8) break;
    if (/--.*color|--brand|--primary|--secondary|--accent|--background|--text/i.test(key)) {
      colors[key.replace(/^--/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value.trim();
    }
  }

  const typography: Record<string, string> = {};
  if (fonts[0]) typography.headingFont = fonts[0];
  if (fonts[1]) typography.bodyFont = fonts[1];

  const metadata: Record<string, string> = {};
  if (websiteData.title) metadata.title = websiteData.title;
  if (websiteData.description) metadata.description = websiteData.description;
  if (websiteData.themeColor) metadata.themeColor = websiteData.themeColor;
  if (websiteData.ogImage) metadata.ogImage = websiteData.ogImage;
  if (websiteData.favicon) metadata.favicon = websiteData.favicon;
  if (websiteData.metaTags?.['og:locale']) metadata.language = websiteData.metaTags['og:locale'];

  return {
    colors,
    typography,
    fonts,
    images: {
      ...(websiteData.ogImage ? { ogImage: websiteData.ogImage } : {}),
      ...(websiteData.favicon ? { favicon: websiteData.favicon } : {}),
    },
    metadata,
  };
}
