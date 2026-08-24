import { z } from 'zod';
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers";

export const targetAudienceSchema = z.object({
  primarySegment: z.string().optional().describe('One vivid sentence naming WHO they serve'),
  demographics: z.record(z.string(), z.any()).optional().describe('ageRange, gender, location, incomeLevel, occupation, education'),
  psychographics: z.record(z.string(), z.any()).optional().describe('values, lifestyle, interests'),
  painPoints: z.array(z.string()).optional().describe('Specific problems this audience has that the business solves'),
  motivations: z.array(z.string()).optional(),
  buyingTriggers: z.array(z.string()).optional().describe('Events/situations that push them to purchase'),
  preferredPlatforms: z.array(z.string()).optional().describe('Where this audience spends time'),
  contentPreferences: z.array(z.string()).optional(),
  secondarySegments: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })).optional(),
}).passthrough().describe('Deep profile of who the business serves');

export const informationSchemaBusinessCore = z.object({
  businessProfile: z.object({
    name: z.string(),
    description: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    category: z.string().optional(),
  }),
  companyInformation: z.string().describe('Comprehensive Markdown research report: Company Overview, Products & Services, Unique Selling Points, Content & Messaging Analysis, Competitive Landscape. Minimum 300 words.'),
  targetAudience: targetAudienceSchema.optional(),
});

export const informationSchemaBusinessBrand = z.object({
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
  }),
});

export const informationSchemaBusinessResponse = informationSchemaBusinessCore.extend({
  brandDetails: informationSchemaBusinessBrand.shape.brandDetails,
});

export type InformationSchemaBusinessResponse = z.infer<typeof informationSchemaBusinessResponse>;

/** Progress events streamed to the frontend as NDJSON lines */
export type InformationExtractionEvent =
  | { type: 'step'; step: 'scrape' | 'core' | 'brand' | 'finalize'; status: 'started' | 'done' }
  | { type: 'complete'; data: InformationSchemaBusinessResponse }
  | { type: 'error'; message: string };

const requestSchema = z.object({
  url: z.string().url(),
  explanation: z.string().min(1),
  competitors: z.array(z.string().url()).optional(),
});

function mergeBrandDetails(
  aiBrand: z.infer<typeof informationSchemaBusinessBrand>['brandDetails'] | undefined,
  websiteData: Awaited<ReturnType<typeof scrapeWebsite>>
): InformationSchemaBusinessResponse['brandDetails'] {
  const facts = buildDeterministicBrandData(websiteData);

  const merged: InformationSchemaBusinessResponse['brandDetails'] = {
    ...(aiBrand ?? {}),
    colors: { ...(aiBrand?.colors ?? {}), ...facts.colors },
    typography: { ...(aiBrand?.typography ?? {}) },
    images: { ...(aiBrand?.images ?? {}), ...facts.images },
    metadata: { ...(aiBrand?.metadata ?? {}), ...facts.metadata },
  };

  if (!merged.typography.headingFont && facts.typography?.headingFont) {
    merged.typography.headingFont = facts.typography.headingFont;
  }
  if (!merged.typography.bodyFont && facts.typography?.bodyFont) {
    merged.typography.bodyFont = facts.typography.bodyFont;
  }

  return merged;
}

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const log = useLogger(event)
    const user = await checkUserIsLogin(event);
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

    log.set({ url, hasCompetitors: !!competitors?.length })

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const send = (payload: InformationExtractionEvent) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
          } catch {
            closed = true;
          }
        };

        try {
          // Step 1: scrape the website (deterministic, fast)
          send({ type: 'step', step: 'scrape', status: 'started' });
          const websiteData = await scrapeWebsite(url);
          send({ type: 'step', step: 'scrape', status: 'done' });

          const corePrompt = schedulerInformationPrompts.extractBusinessInfo(url, explanation, competitors, websiteData);
          const brandPrompt = schedulerInformationPrompts.extractBrandDetails(url, competitors, websiteData);

          // Steps 2+3 run in parallel — wall time is max(both), not sum(both)
          send({ type: 'step', step: 'core', status: 'started' });
          send({ type: 'step', step: 'brand', status: 'started' });

          const corePromise = schedulerUnifiedAI.generateObject({
            prompt: corePrompt,
            schema: informationSchemaBusinessCore,
            temperature: SCHEDULER_INFORMATION_TEMPERATURE,
            userId: user.id,
          }).then((r) => {
            send({ type: 'step', step: 'core', status: 'done' });
            return r;
          });

          const brandPromise = schedulerUnifiedAI.generateObject({
            prompt: brandPrompt,
            schema: informationSchemaBusinessBrand,
            temperature: SCHEDULER_INFORMATION_TEMPERATURE,
            userId: user.id,
          }).then((r) => {
            send({ type: 'step', step: 'brand', status: 'done' });
            return r;
          });

          const [coreResult, brandResult] = await Promise.allSettled([corePromise, brandPromise]);

          if (coreResult.status === 'rejected') {
            throw coreResult.reason instanceof Error ? coreResult.reason : new Error(String(coreResult.reason));
          }

          send({ type: 'step', step: 'finalize', status: 'started' });

          const brandFromAi =
            brandResult.status === 'fulfilled' ? brandResult.value.object.brandDetails : undefined;

          const object: InformationSchemaBusinessResponse = {
            ...coreResult.value.object,
            brandDetails: mergeBrandDetails(brandFromAi, websiteData),
          };

          if (brandResult.status === 'rejected') {
            log.set({ brandExtractionFallback: true })
          }

          send({ type: 'step', step: 'finalize', status: 'done' });
          send({ type: 'complete', data: object });

          log.set({ success: true, businessName: object.businessProfile.name })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          log.error({ content: 'AI Extraction Error', error: message })
          send({ type: 'error', message: message || 'Failed to extract business information via AI' });
        } finally {
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });

    event.node.res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    event.node.res.setHeader('Cache-Control', 'no-cache, no-transform');
    event.node.res.setHeader('X-Accel-Buffering', 'no');

    return stream;
  });
});
