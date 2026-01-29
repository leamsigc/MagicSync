import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const expectedResponseSchema = z.object({
  content: z.string().describe('For short content, the first item is the hook/start. For long content (like articles), this is the full content.'),
  comments: z.array(z.string()).optional().describe('Optional follow-up comments or thread continuation.'),
});

const supportedPlatforms = ['twitter', 'linkedin', 'instagram', 'email', 'facebook', 'tiktok', 'googlemybusiness', 'reddit', 'youtube', 'discord', 'threads', 'dribbble', 'bluesky', 'devto', 'wordpress'] as const;

const supportedTones = ['professional', 'casual', 'witty', 'inspirational', 'direct', 'angry', 'clickbait', 'humorous', 'educational', 'empathetic', 'controversial', 'exciting', 'urgent'] as const;
const platformPrompts = {
  twitter: `Turn the CONTENT into a Twitter thread (5-7 tweets).
Output Format: Plain Text (Thread)

Rules:
- First tweet must hook the reader (curiosity or bold claim)
- Each tweet should stand alone but flow together
- Use line breaks for readability
- End with a call to action or takeaway
- No hashtags in thread (except maybe last tweet)
- Keep each tweet under 280 characters
- Format as "1/" "2/" etc.`,

  linkedin: `Turn the CONTENT into a LinkedIn post.
Output Format: Plain Text (UTF-8)

Rules:
- Start with a hook (first line matters most)
- Use short paragraphs (1-2 sentences each)
- Include a clear takeaway or lesson
- End with a question to drive engagement
- 150-250 words ideal
- Minimal emojis (0-2 max)`,

  instagram: `Turn the CONTENT into an Instagram caption.
Output Format: Plain Text

Rules:
- Start with a hook
- Use emojis naturally (not excessive)
- Break into short paragraphs
- End with a call to action
- Add 5-10 relevant hashtags at the end
- 100-150 words before hashtags`,

  email: `Generate 5 email subject lines for the CONTENT.
Output Format: Plain Text

Rules:
- Each under 50 characters
- Mix of styles: curiosity, benefit, question, urgency, personal
- No clickbait that doesn't deliver
- Would work for a newsletter
- Number them 1-5`,

  facebook: `Turn the CONTENT into a Facebook post.
Output Format: facebook supported markdown

Rules:
- Can be slightly longer than other platforms
- Ask a question or invite discussion
- 100-200 words
- Can use 1-2 emojis if appropriate`,

  tiktok: `Turn the CONTENT into a TikTok video script.
Output Format: Video Script (Spoken Word + Visual Cues)

Rules:
- Format as a spoken script with clear sections: HOOK, BODY, CTA
- HOOK (0-3 sec): Start with a pattern interrupt or bold statement to stop the scroll
- BODY (15-45 sec): Break into 3-5 short, punchy points. Write exactly what to say.
- CTA (3-5 sec): Clear call to action (follow, comment, save, share)
- Keep total script under 60 seconds when spoken
- Include [VISUAL CUE] notes in brackets for on-screen text or actions
- Add energy markers like (pause), (lean in), (point at camera) where helpful
- No hashtags in the script itself`,

  googlemybusiness: `Create a Google Business update for the CONTENT.
Output Format: Plain Text

Rules:
- Focus on "What's New," an Offer, or an Event
- First sentence must include the primary keyword/service (Local SEO)
- Keep length between 80-150 words (concise is better for mobile)
- End with a direct Call to Action (e.g., "Call Now," "Book Online," "Visit Store")
- No hashtags
- Suggest an image type to pair with the post`,

  reddit: `Create a Reddit post (Title + Body) for the CONTENT.
Output Format: Markdown (Bold, Italics, Lists)

Rules:
- Title must be punchy, descriptive, and non-clickbaity (under 120 chars)
- Structure: Context -> The "Meat" (Details) -> Discussion prompt
- Use Markdown formatting: bullet points, bold text for emphasis
- Include a "TL;DR" (Too Long; Didn't Read) summary at the bottom
- No direct selling; focus on adding value or sparking discussion
- Ask a specific question to the community to drive comments`,

  youtube: `Create a YouTube video description for the CONTENT.
Output Format: Plain Text

Rules:
- First 2 lines: High-impact summary including target keywords (Crucial for SEO)
- Structure: Hook -> Detailed Overview -> Resources/Links
- Include a placeholder for [Timestamps] (e.g., 0:00 Intro, 1:30 Key Point)
- Use short paragraphs for readability
- End with engagement actions: "Like, Subscribe, and Comment below [Question]"
- Add 3-5 specific hashtags at the very bottom`,

  discord: `Create a Discord announcement for the CONTENT.
Output Format: Markdown (Bold, Italics, Blockquotes, Code Blocks)

Rules:
- formatting: Use **Bold** for headlines and > Blockquotes for key info
- Start with a clear "Headline" or tag (e.g., 🚨 New Update)
- Keep it scannable: Use emojis as bullet points
- Include a direct link/CTA clearly separated from the text
- Keep it under 200 words
- Encourage reactions (e.g., "React with 🔥 if you're excited")`,

  threads: `Create a Threads post (or short thread) for the CONTENT.
Output Format: Plain Text

Rules:
- Limit: 500 characters per post
- Start with a pattern-interrupting statement or question
- Focus on a single idea per post
- Encourage replies rather than just likes
- If a thread: Number posts (1/3, 2/3) and keep the loop tight
- Minimal to no hashtags`,

  dribbble: `Create a Dribbble shot description for the CONTENT.
Output Format: Plain Text

Rules:
- Focus on the "Why" and "How" of the design
- Structure: Problem Statement -> Solution/Approach -> Tools Used
- Mention specific techniques or design systems used
- Ask for specific feedback (e.g., "What do you think of the typography?")
- Keep it under 100 words`,

  bluesky: `Create a Bluesky post for the CONTENT.
Output Format: Plain Text bluesky supported markdown

Rules:
- Length: Strictly under 300 characters
- Focus on text-based engagement or sharing a "hot take"
- No hashtags (unless used ironically or for specific feeds)
- Format as "1/" "2/" etc.
- If threading, keep it to 3 posts max`,

  devto: `Create a Dev.to article outline and intro for the CONTENT.
Output Format: Markdown (Headers, Code Blocks, Lists)

Rules:
- Title: Clear, descriptive, and problem-solving oriented
- Intro: Hook the reader by stating the specific problem and the solution provided
- Structure: Use ## Headings for scannability
- Include placeholders for code blocks like \`\`\`language \`\`\`
- SEO: Include a "Key Takeaways" list near the top
- Add 4 relevant tags at the end
- Final paragraph: Ask a technical question to provoke comments`,

  wordpress: `Create a WordPress blog post summary/excerpt for the CONTENT.
Output Format: HTML or Plain Text

Rules:
- SEO Focus: Primary keyword must appear in the first sentence
- Length: 100-160 characters (meta description) OR 50-75 words (excerpt)
- Structure: Problem -> Agitation -> Solution
- Use active voice and power words
- Avoid passive voice to maximize AI-search readability
- End with a motivating reason to "Read More"`
} as const;

const toneDescriptions = {
  professional: 'professional and authoritative',
  casual: 'casual and conversational',
  witty: 'witty, playful, and clever',
  inspirational: 'inspirational and motivating',
  direct: 'direct and to-the-point',
  angry: 'firm, frustrated, or passionate complaint',
  clickbait: 'sensational and attention-grabbing',
  humorous: 'funny, entertaining, and light',
  educational: 'informative and instructional',
  empathetic: 'understanding and supportive',
  controversial: 'provocative and debate-sparking',
  exciting: 'enthusiastic and high-energy',
  urgent: 'time-sensitive and compelling',
} as const;

const requestSchema = z.object({
  content: z.string().optional(),
  url: z.string().url().optional(),
  platforms: z.array(z.enum(supportedPlatforms)).min(1),
  tone: z.enum(supportedTones).default('professional'),
}).refine(data => data.content || data.url, {
  message: 'Either content or url must be provided',
});

type Platform = keyof typeof platformPrompts;
type Tone = keyof typeof toneDescriptions;

export default defineLazyEventHandler(async () => {
  const apiKey = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY || '';

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Missing Google Generative AI API key',
    });
  }

  return defineEventHandler(async (event) => {
    await checkUserIsLogin(event)
    const body = await readBody(event);

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: validation.error.flatten(),
      });
    }

    const { content: rawContent, url, platforms, tone } = validation.data;

    let contentToProcess = rawContent || '';

    if (url && !rawContent) {
      try {
        const extracted = await extractMainContent(url);
        contentToProcess = `Title: ${extracted.title}\n\n${extracted.content}`;
      } catch (error: any) {
        throw createError({
          statusCode: 400,
          message: `Failed to scrape URL: ${error.message}`,
        });
      }
    }

    if (!contentToProcess.trim()) {
      throw createError({
        statusCode: 400,
        message: 'No content available to process',
      });
    }

    const systemPrompt = 'You are an expert social media content creator. Your goal is to repurpose the provided content into optimized posts for multiple platforms, following specific rules and tone.';

    // Dynamically build the schema based on requested platforms
    const resultSchema = z.object(
      platforms.reduce((acc, platform) => {
        acc[platform] = expectedResponseSchema;
        return acc;
      }, {} as Record<string, typeof expectedResponseSchema>)
    );

    // Build the prompt including instructions for all requested platforms
    let combinedPrompt = `CONTENT:\n"${contentToProcess}"\n\nTONE: ${toneDescriptions[tone as Tone]}\n\nInstructions per platform:\n`;

    platforms.forEach(platform => {
      combinedPrompt += `\n--- ${platform.toUpperCase()} ---\n${platformPrompts[platform as Platform]}\n`;
    });

    try {
      console.log(combinedPrompt);

      const { object } = await generateObject({
        model: google('gemini-3-flash-preview'),
        schema: resultSchema,
        system: systemPrompt,
        prompt: combinedPrompt,
        temperature: 0.7,
      });

      // Transform the result to match the expected client-side format if needed,
      // or just return the object directly since it matches the keys.
      // The client expects `results: Record<string, ...>`

      // We need to map the output to the exact shape the client expects if it differs.
      // previous client used: results[platform] = { content: string | string[], hook?: string }
      // New schema is { content: string[], comments: string[] }
      // We should probably adapt it to return 'results' object.

      return { results: object };

    } catch (error: any) {
      console.error('AI Generation Error:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to generate AI content',
      });
    }
  });
});
