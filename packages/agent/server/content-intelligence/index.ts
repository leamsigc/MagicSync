/**
 * Pi content-intelligence layer: research → synthesis → idea generation →
 * platform adaptation → validation. Persistence-free by design — it returns
 * validated ideas and the application layer persists them.
 *
 * Public entry: `createContentIntelligence(deps).generateContentIdeas(input)`.
 * Infrastructure (research provider, model completion, business loader) is
 * injected; defaults wire the existing MagicSync services.
 */
export { createContentIntelligence, deriveIdeasFromBrief, loadIdeaBusinessContext } from './generate'
export type {
  ContentIntelligence,
  ContentIntelligenceDeps,
  GenerateIdeasRequest,
  IdeaBusinessContext,
  ResearchCallInput,
  ResearchCallResult,
} from './generate'
export {
  ContentIdeaSchema,
  ContentIdeasResultSchema,
  dedupeIdeas,
  GenerateContentIdeasInputSchema,
  normalizeBrief,
  normalizeIdeaTitle,
  PLATFORM_IDS,
  ResearchResultSchema,
  sanitizeBrief,
} from './schemas'
export type { ContentIdea, ContentIdeasResult, GenerateContentIdeasInput, ResearchResult } from './schemas'
