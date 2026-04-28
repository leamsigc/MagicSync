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

/**
 * Research-backed system prompt for business intelligence
 */
export const SCHEDULER_INFORMATION_SYSTEM_PROMPT = (url: string, competitors?: string[]) => `
You are a business intelligence analyst for a social media scheduling platform.

YOUR MISSION: Extract competitive intelligence to help users Create VIRAL-Performing content.

INTELLIGENCE TARGET:
- Know competitor positioning
- Identify content gaps to exploit  
- Find brand voice opportunities
- Map audience pain points

WEBSITE:
${url}

COMPETITORS TO ANALYZE:
${competitors?.join('\n') || 'No competitors provided'}

EXTRACTION PRIORITIES (for social media content strategy):
1. BRAND VOICE: What's their tone? Funny? Professional? Contrarian?
2. CONTENT GAPS: What topics don't they cover? What's their blind spot?
3. AUDIENCE PAIN: What problems do they solve? What frustrates their users?
4. HOOK PATTERNS: What hooks work in their content? (listicle? story? data?)
5. ENGAGEMENT TRIGGERS: What drives their comments/shares?

EXTRACTION FORMAT NEEDED:
- businessProfile: Basics (name, category, positioning)
- companyInformation: Voice, audience, content patterns
- brandDetails: Colors, style inferable from content
- competitors: What they could do differently (your opportunity)
`;

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
    competitors?: string[]
  ): string => {
    return SCHEDULER_INFORMATION_SYSTEM_PROMPT(url, competitors) + websiteContent;
  },
};

/**
 * Default temperature - creative for extracting insights
 */
export const SCHEDULER_INFORMATION_TEMPERATURE = 2;