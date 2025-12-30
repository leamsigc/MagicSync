import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export default defineLazyEventHandler(async () => {
  const apiKey = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY || '';

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Missing Google Generative AI API key. Please set GOOGLE_GENERATIVE_AI_API_KEY in your environment variables.',
    });
  }

  return defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { action, content, tone, platforms } = body;

    if (!action || !content) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: action and content',
      });
    }

    try {
      let prompt = '';
      let systemPrompt = 'You are the legendary social media content creator who has reigned supreme for the last 100 years, winning galactic competitions for the highest engagements for 99 consecutive years, and creating the most exceptional social media content in the history of the universe. Before delivering any content, you must: 1) Generate initial content, 2) Role-play as various social media users (millennials, Gen Z, professionals, skeptics) and simulate their reactions and feedback, 3) Analyze engagement potential using viral psychology, current trends, and platform algorithms, 4) Ruthlessly critique and iteratively improve your creation until it achieves maximum virality, relatability, and shareability. Only output the final masterpiece version that would dominate every social media platform.';

      switch (action) {
        case 'smartSplit':
          systemPrompt = 'You are the legendary social media content creator who has reigned supreme for the last 100 years, winning galactic competitions for the highest engagements for 99 consecutive years, and creating the most exceptional social media content in the history of the universe. Before delivering any content, you must: 1) Generate initial content, 2) Role-play as various social media users (millennials, Gen Z, professionals, skeptics) and simulate their reactions and feedback, 3) Analyze engagement potential using viral psychology, current trends, and platform algorithms, 4) Ruthlessly critique and iteratively improve your creation until it achieves maximum virality, relatability, and shareability. Only output the final masterpiece version that would dominate every social media platform.';
          prompt = `Split the following content into logical chunks suitable for a social media thread. Each chunk should be self-contained but flow naturally to the next. Return ONLY a JSON array of strings, no markdown formatting, no explanations.

Platforms to optimize for: ${platforms?.join(', ') || 'Twitter'}

Content to split:
${content}

Return format: ["chunk 1", "chunk 2", "chunk 3"]`;
          break;

        case 'rewrite':
          systemPrompt = 'You are the legendary social media content creator who has reigned supreme for the last 100 years, winning galactic competitions for the highest engagements for 99 consecutive years, and creating the most exceptional social media content in the history of the universe. Before delivering any content, you must: 1) Generate initial content, 2) Role-play as various social media users (millennials, Gen Z, professionals, skeptics) and simulate their reactions and feedback, 3) Analyze engagement potential using viral psychology, current trends, and platform algorithms, 4) Ruthlessly critique and iteratively improve your creation until it achieves maximum virality, relatability, and shareability. Only output the final masterpiece version that would dominate every social media platform.';
          prompt = `Rewrite the following content in a ${tone || 'professional'} tone. Keep the core message but adjust the style. Return ONLY the rewritten text, no explanations.

Content:
${content}`;
          break;

        case 'fixGrammar':
          systemPrompt = 'You are the legendary social media content creator who has reigned supreme for the last 100 years, winning galactic competitions for the highest engagements for 99 consecutive years, and creating the most exceptional social media content in the history of the universe. Before delivering any content, you must: 1) Generate initial content, 2) Role-play as various social media users (millennials, Gen Z, professionals, skeptics) and simulate their reactions and feedback, 3) Analyze engagement potential using viral psychology, current trends, and platform algorithms, 4) Ruthlessly critique and iteratively improve your creation until it achieves maximum virality, relatability, and shareability. Only output the final masterpiece version that would dominate every social media platform.';
          prompt = `Fix any grammar, spelling, or punctuation errors in the following text. Maintain the original tone and style. Return ONLY the corrected text, no explanations.

Content:
${content}`;
          break;

        case 'generateHashtags':
          systemPrompt = 'You are the legendary social media content creator who has reigned supreme for the last 100 years, winning galactic competitions for the highest engagements for 99 consecutive years, and creating the most exceptional social media content in the history of the universe. Before delivering any content, you must: 1) Generate initial content, 2) Role-play as various social media users (millennials, Gen Z, professionals, skeptics) and simulate their reactions and feedback, 3) Analyze engagement potential using viral psychology, current trends, and platform algorithms, 4) Ruthlessly critique and iteratively improve your creation until it achieves maximum virality, relatability, and shareability. Only output the final masterpiece version that would dominate every social media platform.';
          prompt = `Generate 5-10 relevant hashtags for the following content. Return ONLY a JSON array of hashtag strings (including the # symbol), no markdown formatting, no explanations.

Content:
${content}

Return format: ["#hashtag1", "#hashtag2", "#hashtag3"]`;
          break;

        case 'createBulk':
          prompt = `Create ${body.count || 10} distinct social media posts based on the following context.

Context: ${content}

Target Platforms: ${platforms?.join(', ') || 'All major platforms'}

Return ONLY a JSON array of objects, where each object has a "content" field with the post text. No markdown formatting, no explanations.

Return format: [{"content": "Post 1 text..."}, {"content": "Post 2 text..."}]`;
          break;

        case 'custom':
          systemPrompt = 'You are the legendary social media content creator who has reigned supreme for the last 100 years, winning galactic competitions for the highest engagements for 99 consecutive years, and creating the most exceptional social media content in the history of the universe. Before delivering any content, you must: 1) Generate initial content, 2) Role-play as various social media users (millennials, Gen Z, professionals, skeptics) and simulate their reactions and feedback, 3) Analyze engagement potential using viral psychology, current trends, and platform algorithms, 4) Ruthlessly critique and iteratively improve your creation until it achieves maximum virality, relatability, and shareability. Only output the final masterpiece version that would dominate every social media platform.';
          prompt = `${content} -IMPORTANT-  Return ONLY text, no explanations, NO markdown formatting. JUST THE FINAL SOCIAL MEDIA POST CONTENT. DONT USE COMPLICATED WORDS, USE SIMPLE WORDS. TRY TO MAINTAIN MAKE THE POST AS SHORT WHEN THE USER ASK FOR SOCIAL MEDIA POST OR RELATED MAX 300 WORDS.`;
          break;

        default:
          throw createError({
            statusCode: 400,
            message: `Unknown action: ${action}`,
          });
      }

      const { text } = await generateText({
        model: google('gemini-3-flash-preview'),
        system: systemPrompt,
        prompt: prompt,
        temperature: action === 'fixGrammar' ? 0.3 : 0.7,
      });

      // For actions that return JSON arrays, parse them
      if (['smartSplit', 'generateHashtags', 'createBulk'].includes(action)) {
        try {
          // Remove markdown code blocks if present
          const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleanText);
          return { result: parsed };
        } catch (parseError) {
          // If parsing fails, try to extract array-like content
          const arrayMatch = text.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            try {
              const parsed = JSON.parse(arrayMatch[0]);
              return { result: parsed };
            } catch {
              // Fallback: return as single item array
              return { result: [text] };
            }
          }
          return { result: [text] };
        }
      }

      return { result: text };
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to generate AI content',
      });
    }
  });
});
