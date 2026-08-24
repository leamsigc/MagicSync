/**
 * System Prompts for Information Extraction AI Endpoint
 *
 * Split into two focused prompts so they can run as parallel AI calls:
 * - Core: business profile, detailed company information, target audience
 * - Brand: visual identity (colors, typography, imagery, design system)
 *
 * Usage (auto-imported):
 * ```ts
 * const prompt = schedulerInformationPrompts.extractBusinessInfo(url, explanation, competitors, websiteData);
 * ```
 */

import { pickRelevantCssVariables } from './businessInfoHelpers';

export interface ScrapedWebsitePromptData {
  textContent?: string;
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
  themeColor?: string;
  fonts?: string[];
  cssVariables?: Record<string, string>;
  metaTags?: Record<string, string>;
}

const MAX_TEXT_CONTENT = 8000;

function serializeScrapeContext(websiteData?: ScrapedWebsitePromptData): string {
  if (!websiteData) return 'No website data available';

  const serializedMetadata = JSON.stringify({
    title: websiteData.title,
    description: websiteData.description,
    ogImage: websiteData.ogImage,
    favicon: websiteData.favicon,
    themeColor: websiteData.themeColor,
    fonts: websiteData.fonts,
    cssVariables: pickRelevantCssVariables(websiteData.cssVariables || {}),
    metaTags: websiteData.metaTags,
  }, null, 2);

  const textContent = (websiteData.textContent || 'No page text content available').slice(0, MAX_TEXT_CONTENT);

  return `=== SCRAPED METADATA ===
${serializedMetadata}

=== PAGE TEXT CONTENT ===
${textContent}`;
}

const COMPETITIVE_CONTEXT = (url: string, competitors?: string[]) => `
WEBSITE URL: ${url}
COMPETITORS TO ANALYZE: ${competitors?.join(', ') || 'None provided'}
`;

/**
 * Prompt 1 — Core business intelligence.
 * Business profile, deep company research report, and target audience analysis.
 */
const CORE_EXTRACTION_PROMPT = (url: string, competitors?: string[], websiteData?: ScrapedWebsitePromptData) => `
You are a senior business analyst producing a research report for a social media scheduling platform.

${COMPETITIVE_CONTEXT(url, competitors)}

${serializeScrapeContext(websiteData)}

=== YOUR TASK ===
Produce a DETAILED, specific report. Never generic. Use facts from the page content; when inferring, mark with "(inferred)".

1. businessProfile: name, description, category, phone, address, website — extract directly from metadata/content.

2. companyInformation: A comprehensive Markdown research report with these REQUIRED sections:
   - "## Company Overview" — what they do, history, scale, positioning
   - "## Products & Services" — concrete offerings with details
   - "## Unique Selling Points" — what differentiates them vs competitors
   - "## Content & Messaging Analysis" — their tone, hook patterns, engagement triggers, topics they cover and content gaps they miss
   - "## Competitive Landscape" — how they compare to any provided competitors
   Minimum 300 words. Write flowing prose and bullet points, not placeholders.

3. targetAudience: The MOST IMPORTANT output. Be specific and opinionated:
   - primarySegment: one vivid sentence naming WHO they serve (e.g. "Solo estheticians aged 25-40 running home-based studios")
   - demographics: ageRange, gender, location, incomeLevel, occupation, education
   - psychographics: values, lifestyle, interests
   - painPoints: 3-6 specific problems this audience has that the business solves
   - motivations: what drives them to buy
   - buyingTriggers: events/situations that push them to purchase
   - preferredPlatforms: where this audience spends time (instagram, tiktok, linkedin...)
   - contentPreferences: formats/topics that resonate with them
   - secondarySegments: 1-3 additional audience segments with name + description

Return ONLY data grounded in or reasonably inferred from the provided material.
`;

/**
 * Prompt 2 — Brand identity extraction.
 * Visual identity only: colors, typography, imagery, components, design system.
 */
const BRAND_EXTRACTION_PROMPT = (url: string, competitors?: string[], websiteData?: ScrapedWebsitePromptData) => `
You are a brand designer reverse-engineering the visual identity of a website.

${COMPETITIVE_CONTEXT(url, competitors)}

${serializeScrapeContext(websiteData)}

=== YOUR TASK ===
Populate EVERY brandDetails field with actual observed or well-inferred values. NEVER return empty objects.

- colorScheme: overall scheme description (e.g. "Dark Modern", "Warm Minimal")
- colors: ACTUAL hex/rgb values. Priority order: cssVariables → metaTags.theme-color → inference from colorScheme. Keys: primary, secondary, accent, background, text.
- typography: font families from fonts array / cssVariables (--font-*). Keys: headingFont, bodyFont, baseSize.
- spacing: spacing scale from --spacing/--gap vars. Keys: unit, scale.
- components: UI patterns from HTML structure. Keys: buttonStyle, cardStyle, navigation.
- images: logo URL (look for logo img/svg in content), favicon, ogImage, imageStyle (photography/illustration style).
- personality: tone, voice derived from page copy. Keys: tone, voice, targetAudience.
- designSystem: framework hints (tailwind/bootstrap/custom), approach, animations. Keys: framework, approach, animations.
- metadata: title, description, themeColor, ogImage, favicon, language — direct from metaTags.

If a value is not directly observable, make a reasonable inference and note it with "(inferred)".
Return ONLY the brandDetails object.
`;

/**
 * Prompt builders
 */
export const schedulerInformationPrompts = {
  /** Core business intelligence prompt */
  extractBusinessInfo: (
    url: string,
    websiteContent?: string,
    competitors?: string[],
    scrapeWebsite?: ScrapedWebsitePromptData
  ): string =>
    CORE_EXTRACTION_PROMPT(url, competitors, scrapeWebsite) +
    (websiteContent ? `\n=== USER GOAL ===\n${websiteContent}\n` : ''),

  /** Brand identity extraction prompt */
  extractBrandDetails: (
    url: string,
    competitors?: string[],
    scrapeWebsite?: ScrapedWebsitePromptData
  ): string => BRAND_EXTRACTION_PROMPT(url, competitors, scrapeWebsite),
};

/**
 * Extraction is a precision task — low temperature for fast, deterministic,
 * non-rambling output. (Was previously 2 which caused slow, erratic results.)
 */
export const SCHEDULER_INFORMATION_TEMPERATURE = 0.2;
