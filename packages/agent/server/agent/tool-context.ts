import type { H3Event } from 'h3'
import type { Model } from '@earendil-works/pi-ai'
import type { ModelRuntime, ToolDefinition } from '@earendil-works/pi-coding-agent'
import type { AgentStreamEventListener } from './agent-events'
import type { ScrapegraphClientLike } from '../utils/scrapegraph'
import type { LangSearchClient } from '../utils/langsearch'

/** Provider completion bound to the per-business model (pi ModelRuntime). */
export type AgentComplete = (input: { system?: string, prompt: string, maxTokens?: number }) => Promise<string>

/** Embedding function bound to the per-business embedding provider. */
export type AgentEmbedder = (texts: string[]) => Promise<number[][]>

/**
 * Server-owned context injected into every agent tool. Tenant identity comes
 * from the authenticated request, never from model-supplied tool arguments.
 */
export interface AgentToolContext {
  userId: string
  businessId: string
  sessionId?: string
  event?: H3Event
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
  /** Runtime + resolved model enable in-process `subagent` delegation. */
  modelRuntime?: ModelRuntime
  model?: Model<any>
  /** Full session tool set used to build isolated subagent tool lists. */
  subagentTools?: ToolDefinition[]
}

export function createAgentToolContext(input: {
  userId: string
  businessId: string
  sessionId?: string
  event?: H3Event
  emit?: AgentStreamEventListener
  complete?: AgentComplete
  embed?: AgentEmbedder
  scrapegraph?: ScrapegraphClientLike
  langsearch?: LangSearchClient
  langsearchKey?: string | null
  validateUrl?: (url: string) => Promise<string | null>
  modelRuntime?: ModelRuntime
  model?: Model<any>
  subagentTools?: ToolDefinition[]
}): AgentToolContext {
  return {
    userId: input.userId,
    businessId: input.businessId,
    sessionId: input.sessionId,
    event: input.event,
    emit: input.emit ?? (() => {}),
    complete: input.complete,
    embed: input.embed,
    scrapegraph: input.scrapegraph,
    langsearch: input.langsearch,
    langsearchKey: input.langsearchKey,
    validateUrl: input.validateUrl,
    modelRuntime: input.modelRuntime,
    model: input.model,
    subagentTools: input.subagentTools,
  }
}
