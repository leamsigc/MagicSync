import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export default defineLazyEventHandler(async () => {
    const apiKey = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY || '';

    if (!apiKey) {
        throw createError({
            statusCode: 500,
            message: 'Missing Google Generative AI API key.',
        });
    }

    return defineEventHandler(async (event) => {
        const { messages } = await readBody(event);

        const result = streamText({
            model: google('gemini-1.5-pro-latest'), // Use a capable model
            system: 'You are a helpful social media assistant. You can help users generate bulk social media posts. When asked to generate posts, use the generateBulkPosts tool. ALWAYS use the tool if the user asks for multiple posts. Do not just list them in text.',
            messages,
            maxSteps: 5, // Allow tool execution
            tools: {
                generateBulkPosts: tool({
                    description: 'Generate a list of social media posts based on a topic and count',
                    parameters: z.object({
                        topic: z.string().describe('The topic or context for the posts'),
                        count: z.number().default(5).describe('Number of posts to generate'),
                        platforms: z.array(z.string()).optional().describe('Target platforms'),
                    }),
                    execute: async ({ topic, count, platforms }) => {
                        // We can reuse the logic from generate.post.ts or just call the model again to generate the JSON
                        // Or simply return the structured data here if we can generate it.
                        // For simplicity, let's ask the model to generate the posts in the tool execution
                        // maximizing the quality.

                        const prompt = `Create ${count} distinct social media posts about: ${topic}. Target platforms: ${platforms?.join(', ') || 'General'}. Return ONLY a JSON array of objects with "content" field.`;

                        const { generateText } = await import('ai');
                        const generation = await generateText({
                            model: google('gemini-1.5-flash'), // Use flash for speed in tool
                            prompt: prompt
                        });

                        const text = generation.text;
                        try {
                            const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            const parsed = JSON.parse(cleanText);
                            return parsed; // Returns Array<{content: string}>
                        } catch (e) {
                            return [{ content: "Error generating posts in the requested format. Please try again." }];
                        }
                    },
                }),
            },
        });

        return result.toDataStreamResponse();
    });
});
