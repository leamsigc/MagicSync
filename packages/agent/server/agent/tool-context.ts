import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { AgentStreamEventListener } from './agent-events'
import type { ScrapegraphClientLike } from '../utils/scrapegraph'
import type { LangSearchClient } from '../utils/langsearch'

/** Provider completion bound to the per-business model for this run. */
export type AgentComplete = (input: { system?: string, prompt: string, maxTokens?: number }) => Promise<string>

/** Embedding function bound to the per-business embedding provider. */
export type AgentEmbedder = (texts: string[]) => Promise<number[][]>

/**
 * Server-owned context injected into every agent tool. Tenant identity comes
 * from the authenticated request, never from model-supplied tool arguments.
 *
 * T28: the pi `ModelRuntime`/`Model` pair is gone (the tool modules carry no
 * pi type any more) and `ToolDefinition` is Flue's. Every tool closes over
 * this object at mount time — the model's `toolCtx.data` carries no identity.
 */
export interface AgentToolContext {
  userId: string
  businessId: string
  sessionId?: string
  event?: H3Event
  /** Request logger for tool-level observability. */
  log?: RequestLogger
  emit: AgentStreamEventListener
  complete?: AgentComplete
  embed?: AgentEmbedder
  /** Test seam: injected ScrapeGraphAI client (default resolver reads user settings). */
  scrapegraph?: ScrapegraphClientLike
  /** Test seam: injected LangSearch client (default: live API with the resolved key). */
  langsearch?: LangSearchClient
  /** Test seam: LangSearch key override; undefined falls back to settings/env. */
  langsearchKey?: string | null
  /** Test seam: SSRF validator override (default: validatePublicSiteUrl). */
  validateUrl?: (url: string) => Promise<string | null>
  /** Original request supplied by the carousel harness; prevents source-card drift. */
  carouselRequest?: string
}

export function createAgentToolContext(input: {
  userId: string
  businessId: string
  sessionId?: string
  event?: H3Event
  log?: RequestLogger
  emit?: AgentStreamEventListener
  complete?: AgentComplete
  embed?: AgentEmbedder
  scrapegraph?: ScrapegraphClientLike
  langsearch?: LangSearchClient
  langsearchKey?: string | null
  validateUrl?: (url: string) => Promise<string | null>
  carouselRequest?: string
}): AgentToolContext {
  return {
    userId: input.userId,
    businessId: input.businessId,
    sessionId: input.sessionId,
    event: input.event,
    log: input.log,
    emit: input.emit ?? (() => {}),
    complete: input.complete,
    embed: input.embed,
    scrapegraph: input.scrapegraph,
    langsearch: input.langsearch,
    langsearchKey: input.langsearchKey,
    validateUrl: input.validateUrl,
    carouselRequest: input.carouselRequest,
  }
}
