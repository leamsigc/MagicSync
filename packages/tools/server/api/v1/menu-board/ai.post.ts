import { z } from 'zod'

const aiSchema = z.object({
  prompt: z.string().min(1).max(4000),
  currentHtml: z.string().max(500_000).optional(),
})

const SYSTEM_PROMPT = `You are an expert digital signage designer specialising in restaurant TV menu boards.
Your task is to create or modify a full-screen, non-scrollable HTML menu board for a 16:9 TV display that customers read from a distance inside a restaurant.

CRITICAL CONSTRAINTS:
1. The output MUST be ONLY valid HTML code. DO NOT wrap it in markdown blocks.
2. The outermost container MUST have inline styles ensuring it is exactly 100vw and 100vh, with overflow: hidden, margin: 0, padding: 0, and box-sizing: border-box.
3. Use inline CSS only. No external stylesheets or scripts.
4. Typography must be LARGE and high contrast — item names at least 1.6rem, prices prominent, readable from 3+ metres on a TV.
5. Use dotted leader lines between item names and prices, clear section headers, and generous spacing.
6. Use https://picsum.photos placeholder photos if images help (e.g. https://picsum.photos/seed/pizza/800/600).
7. If current HTML is provided, modify it according to the user's request while keeping the overall structure intact unless asked to redesign.`

function stripMarkdownFence(html: string): string {
  return html
    .replace(/^```html\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    // AI generation uses the system AI connection (paid API credits) — logged-in users only.
    const user = await checkUserIsLogin(event)

    const body = await readBody(event)
    const parsed = aiSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'A prompt is required' })
    }

    const contents = parsed.data.currentHtml
      ? `CURRENT HTML:\n${parsed.data.currentHtml}\n\nUSER REQUEST: ${parsed.data.prompt}\n\nPlease provide the complete updated HTML.`
      : `USER REQUEST: ${parsed.data.prompt}\n\nPlease provide the complete HTML.`

    log.set({ userId: user.id, hasCurrentHtml: !!parsed.data.currentHtml })

    const { text } = await toolsUnifiedAI.generateText({
      systemPrompt: SYSTEM_PROMPT,
      prompt: contents,
      userId: user.id,
    })

    return { html: stripMarkdownFence(text || '') }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    log.error({ content: 'Menu board AI generation failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate menu content' })
  }
})
