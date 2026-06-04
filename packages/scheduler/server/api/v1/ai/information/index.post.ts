import { z } from 'zod';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers";

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
  brandDetails: z.object({
    colorScheme: z.string(),
    colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      background: z.string().optional(),
      text: z.string().optional(),
    }).passthrough().describe('Brand color palette with hex/rgb values'),
    typography: z.object({
      headingFont: z.string().optional(),
      bodyFont: z.string().optional(),
      baseSize: z.string().optional(),
    }).passthrough().describe('Font families and sizes used on the site'),
    spacing: z.record(z.string(), z.any()).optional().describe('Spacing scale and layout patterns'),
    components: z.record(z.string(), z.any()).optional().describe('UI component patterns: buttons, cards, navigation'),
    images: z.record(z.string(), z.any()).optional().describe('Brand imagery: logo URL, favicon, ogImage, image style'),
    personality: z.object({
      tone: z.string().optional(),
      voice: z.string().optional(),
      targetAudience: z.string().optional(),
    }).passthrough().describe('Brand character, tone of voice, and audience'),
    designSystem: z.record(z.string(), z.any()).optional().describe('Design framework, approach, animations'),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      themeColor: z.string().optional(),
      ogImage: z.string().optional(),
      favicon: z.string().optional(),
      language: z.string().optional(),
    }).passthrough().describe('Page metadata extracted from meta tags'),
  })
});
export type InformationSchemaBusinessResponse = z.infer<typeof informationSchemaBusinessResponse>;

const requestSchema = z.object({
  url: z.string().url(),
  explanation: z.string().min(1),
  competitors: z.array(z.string().url()).optional(),
});

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const log = useLogger(event)
    await checkUserIsLogin(event);
    const body = await readBody(event);

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      log.set({ validationError: true })
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: validation.error.flatten(),
      });
    }

    const { url, explanation, competitors } = validation.data;

    try {
      log.set({ url, hasCompetitors: !!competitors?.length })
      const websiteData = await scrapeWebsite(url);
      const prompt = schedulerInformationPrompts.extractBusinessInfo(url, explanation, competitors, websiteData);

      const { object } = await schedulerUnifiedAI.generateObject({
        prompt,
        schema: informationSchemaBusinessResponse,
        temperature: SCHEDULER_INFORMATION_TEMPERATURE,
      });

      log.set({ success: true, businessName: object.businessProfile.name, rawData: object })
      return object;
    } catch (error: any) {
      log.error({ content: 'AI Extraction Error', error: String(error) })
      throw createError({
        statusCode: 500,
        message: error.message || 'Failed to extract business information via AI',
      });
    }
  });
});
