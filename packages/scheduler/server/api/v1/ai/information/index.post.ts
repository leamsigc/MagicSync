import { z } from 'zod';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers";

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

export const informationSchemaBusinessResponse = z.object({
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
export type InformationSchemaBusinessResponse = z.infer<typeof informationSchemaBusinessResponse>;

const requestSchema = z.object({
  url: z.string().url(),
  explanation: z.string().min(1),
  competitors: z.array(z.string().url()).optional(),
});

export default defineLazyEventHandler(async () => {
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
      const prompt = schedulerInformationPrompts.extractBusinessInfo(url, explanation, competitors);

      const { object } = await schedulerUnifiedAI.generateObject({
        prompt,
        schema: informationSchemaBusinessResponse,
        temperature: SCHEDULER_INFORMATION_TEMPERATURE,
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
