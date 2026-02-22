import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers";
import { CreateBusinessProfileSchema } from '#layers/BaseDB/db/schema';

// This matches the simplified expected keys from prompt
const brandDetailsSchema = z.object({
  colorScheme: z.string(),
  colors: z.record(z.string(), z.string()),
  typography: z.record(z.string(), z.any()).optional(),
  spacing: z.record(z.string(), z.any()).optional(),
  components: z.record(z.string(), z.any()).optional(),
  images: z.record(z.string(), z.any()).optional(),
  personality: z.record(z.string(), z.any()).optional(),
  designSystem: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).passthrough();

const responseSchema = z.object({
  businessProfile: z.object({
    name: z.string(),
    description: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    category: z.string().optional(),
  }),
  companyInformation: z.string().describe('Detailed company information in Markdown format as a research report.'),
  brandDetails: brandDetailsSchema.describe('Brand details extracted from the website in JSON format.')
});

const requestSchema = z.object({
  url: z.string().url(),
  explanation: z.string().min(1),
  competitors: z.array(z.string().url()).optional(),
});

export default defineLazyEventHandler(async () => {
  const apiKey = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY || '';

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Missing Google Generative AI API key',
    });
  }

  return defineEventHandler(async (event) => {
    await checkUserIsLogin(event);
    const body = await readBody(event);

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: validation.error.flatten(),
      });
    }

    const { url, explanation, competitors } = validation.data;

    try {
      const systemPrompt = `
You are an expert business researcher and competitive analyst. Your goal is to extract detailed information about a business from its website and format it for our system.
The user needs this website to get all the information related to the user business for:
${url}.

DIRECT COMPETITORS URLS:
${competitors?.join('\n') || 'No competitors provided'}.



We need 3 things from you:
1. 'businessProfile': Basic profile data (name, description, address, phone, website, category) filling in as much as reasonably possible.
2. 'companyInformation': A deeply detailed Markdown report titled "# Product Research Report". Include sections like Company Information (Background, Story & Mission, Founders & Team, Brand & Visual Identity), Product Information (Overview, Value Proposition, How it works, Key Features, Use Cases, Tech Stack, Target Audience, Pricing, Industry), and Customer Information.
3. 'brandDetails': A robust JSON matching the brand details extraction structure, guessing color palettes and typography if exact values can't be scraped but styles are implied. Includes colors, typography, spacing, etc. Make it as complete as possible.
4. 'competitors': A list of competitors and their URLs base on the content of the website.
WEBSITE:
${url}
`;

      const { object } = await generateObject({
        model: google('gemini-3-flash-preview'),
        schema: responseSchema,
        system: systemPrompt,
        prompt: 'Generate the structured business extraction object.',
        temperature: 0.4,
      });

      return object;
    } catch (error: any) {
      console.error('AI Extraction Error:', error);
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to extract business information via AI',
      });
    }
  });
});
