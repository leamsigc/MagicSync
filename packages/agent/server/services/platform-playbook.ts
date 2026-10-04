/**
 * Per-platform best-performance playbook for the writer agent, plus the
 * identifiers it defines.
 *
 * This is data, not behaviour, and it is the single source of truth for which
 * platforms have first-class content rules. It lives in its own leaf module
 * because both the content chain and the content-intelligence schemas need it.
 * Keeping it inside `content-chain.service.ts` made those two import each
 * other through a chain that runs `content-chain -> content-scoring ->
 * flue/skills -> create-content-ideas -> content-intelligence`, so the first
 * module evaluated read `IDEA_PLATFORM_IDS` before it was initialised.
 */

// Unknown platforms fall back to the general rule.
const PLATFORM_PLAYBOOK: Record<string, string> = {
  instagram: 'Instagram: hook in first 125 chars, 138-150 char core message, 3-5 niche hashtags at the end, visual-first CTA (save/share), max 3 emojis.',
  tiktok: 'TikTok: punchy conversational hook in the first 20 words, 100-150 chars, 3-4 hashtags including a niche tag, CTA asks for a comment or stitch.',
  twitter: 'Twitter/X: max 280 chars, one hook + one fact + CTA, max 2 hashtags, no emoji overload.',
  x: 'X (Twitter): max 280 chars, one hook + one fact + CTA, max 2 hashtags, no emoji overload.',
  linkedin: 'LinkedIn: professional tone, 150-300 words, short paragraphs with line breaks, question-led opening, max 3 hashtags, value-first CTA.',
  facebook: 'Facebook: 40-80 words, warm tone, max 2 hashtags, link or comment CTA phrased as a question.',
  threads: 'Threads: 200-300 chars, casual witty tone, max 2 hashtags, conversational CTA.',
  bluesky: 'Bluesky: max 300 chars, plain language, max 2 hashtags, no engagement bait.',
  youtube: 'YouTube: title-like first line under 70 chars, 2-3 sentence description, 3-5 hashtags, subscribe/watch CTA.',
  reddit: 'Reddit: no hashtags, plain helpful tone, lead with the takeaway, end with a discussion question.',
  wordpress: 'WordPress/blog: 300-600 words, H2 sections, SEO keyword in the first 100 words, excerpt + CTA.',
}

/** Platform identifiers with first-class content rules (single source of truth). */
export const IDEA_PLATFORM_IDS: string[] = Object.keys(PLATFORM_PLAYBOOK)

export function platformGuidance(platforms: string[]): string {
  const lines: string[] = []
  for (const platform of platforms) {
    const rule = PLATFORM_PLAYBOOK[platform.toLowerCase()]
    if (rule) lines.push(rule)
  }
  if (lines.length === 0) return 'General: hook first, one idea per post, max 5 hashtags, single clear CTA.'
  return lines.join('\n')
}