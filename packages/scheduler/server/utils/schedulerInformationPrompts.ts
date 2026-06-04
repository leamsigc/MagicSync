/**
 * System Prompts for Information Extraction AI Endpoint
 *
 * Optimized for extracting business intelligence for competitive advantage.
 *
 * Usage (auto-imported):
 * ```ts
 * const prompt = schedulerInformationPrompts.extractBusinessInfo(url, explanation, competitors);
 * ```
 */

export const SCHEDULER_INFORMATION_SYSTEM_PROMPT = (url: string, competitors?: string[], scrapeWebsite?: ScrapedWebsiteData) => {
  const serializedMetadata = scrapeWebsite ? JSON.stringify({
    title: scrapeWebsite.title,
    description: scrapeWebsite.description,
    ogImage: scrapeWebsite.ogImage,
    favicon: scrapeWebsite.favicon,
    themeColor: scrapeWebsite.themeColor,
    fonts: scrapeWebsite.fonts,
    cssVariables: scrapeWebsite.cssVariables,
    metaTags: scrapeWebsite.metaTags,
  }, null, 2) : 'No website data available';

  const textContent = scrapeWebsite?.textContent || 'No page text content available';

  return `
You are a business intelligence analyst for a social media scheduling platform.

YOUR MISSION: Extract competitive intelligence to help users create viral-performing content.

WEBSITE URL: ${url}

=== SCRAPED METADATA ===
${serializedMetadata}

=== PAGE TEXT CONTENT ===
${textContent}

=== COMPETITORS TO ANALYZE ===
${competitors?.join('\n') || 'No competitors provided'}

=== EXTRACTION PRIORITIES (for social media content strategy) ===
1. BRAND VOICE: What's their tone? Funny? Professional? Contrarian?
2. CONTENT GAPS: What topics don't they cover? What's their blind spot?
3. AUDIENCE PAIN: What problems do they solve? What frustrates their users?
4. HOOK PATTERNS: What hooks work in their content? (listicle? story? data?)
5. ENGAGEMENT TRIGGERS: What drives their comments/shares?

=== BRAND DETAILS EXTRACTION — MUST POPULATE ALL FIELDS ===
You MUST populate every brandDetails field below with actual extracted values. Do NOT return empty objects. Use the provided metadata, text content, and HTML to extract or infer each value.

Instructions per field:
- **colorScheme**: Overall scheme description (e.g. "Dark Modern", "Corporate Blue")
- **colors**: Populate with ACTUAL observed colors. Check: cssVariables for color values → metaTags.theme-color → inline styles. Extract at LEAST primary. Keys: primary, secondary, accent, background, text. Values must be hex/rgb strings.
- **typography**: Extract font families from fonts array (Google Fonts URLs contain font family names), cssVariables (look for --font-* vars), or infer from text style. Keys: headingFont, bodyFont, baseSize.
- **spacing**: Spacing patterns from CSS variables (--spacing-*, --gap-*) or layout description. Keys: unit, scale.
- **components**: UI descriptions from HTML patterns. Keys: buttonStyle, cardStyle, navigation.
- **images**: URLs from ogImage, favicon, and any logo/img tags inferred from page content. Keys: logo, favicon, ogImage, imageStyle.
- **personality**: Extract from page text content tone. Keys: tone, voice, targetAudience.
- **designSystem**: Patterns inferred from CSS classes and HTML structure. Keys: framework, approach, animations.
- **metadata**: Direct extract from metaTags. Keys: title, description, themeColor, ogImage, favicon, language.

IMPORTANT: Extract real data — do not return {} for any field. If a value is not directly observable, make a reasonable inference and note it with "(inferred)".
`;
};

/**
 * Prompt builders
 */
export const schedulerInformationPrompts = {
  /**
   * Extract business intelligence
   */
  extractBusinessInfo: (
    url: string,
    websiteContent: string,
    competitors?: string[],
    scrapeWebsite?: ScrapedWebsiteData
  ): string => {
    return SCHEDULER_INFORMATION_SYSTEM_PROMPT(url, competitors, scrapeWebsite) + websiteContent;
  },
};

/**
 * Default temperature - creative for extracting insights
 */
export const SCHEDULER_INFORMATION_TEMPERATURE = 2;
