import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import type { AgentComplete } from '../agent/tool-context'
import type { ExecutableSkill, SkillRunContext } from '../agentic/contracts'
import type { LangSearchClient } from '../utils/langsearch'
import { analyzeBusinessSkill } from '../agentic/skills/analyze-business'
import { researchCompetitorsSkill } from '../agentic/skills/research-competitors'
import { discoverOpportunitiesSkill } from '../agentic/skills/discover-opportunities'
import { createMarketingPlanSkill } from '../agentic/skills/create-marketing-plan'
import { identifyNextActionSkill } from '../agentic/skills/identify-next-action'
import { createContentIdeasSkill } from '../agentic/skills/create-content-ideas'

/**
 * T08 Flue tools executing goal skills (PRD §8.1). Each tool is a thin
 * boundary adapter (locked decision 8): Valibot input at the Flue boundary,
 * the skill's own zod contracts and run/verify untouched. All tools share
 * one per-run `previous` store so evidence chains deterministically
 * (research → analysis → opportunities → plan → next action) without the
 * model forwarding payloads. Skill failures throw: the model sees a tool
 * error and the run continues within bounds; downstream skills fail loud on
 * missing evidence instead of inventing it.
 */

export interface SkillToolContext {
  userId: string
  businessId: string
  goal: string
  systemContext: string
  complete: AgentComplete
  langsearch?: LangSearchClient
  langsearchKey?: string | null
  /** Shared per-run evidence store, keyed by skill id. */
  previous: Record<string, unknown>
}

const focusField = v.optional(v.pipe(v.string(), v.maxLength(300)))

function skillContext(ctx: SkillToolContext): SkillRunContext {
  return {
    userId: ctx.userId,
    businessId: ctx.businessId,
    goal: ctx.goal,
    systemContext: ctx.systemContext,
    complete: ctx.complete,
    previous: ctx.previous,
    langsearch: ctx.langsearch,
    langsearchKey: ctx.langsearchKey,
  }
}

async function runSkill(
  skill: ExecutableSkill,
  ctx: SkillToolContext,
  input: unknown,
): Promise<{ output: unknown }> {
  const outcome = await skill.run(skillContext(ctx), input)
  if (!outcome.success) throw new Error(outcome.error)
  if (outcome.data === undefined) throw new Error(`Skill ${skill.id} returned no data`)
  ctx.previous[skill.id] = outcome.data
  return { output: outcome.data }
}

export function createSkillTools(ctx: SkillToolContext): Record<string, ToolDefinition> {
  const analyzeBusiness = defineTool({
    name: 'analyze-business',
    description: analyzeBusinessSkill.description,
    input: v.object({ focus: focusField }),
    run: async toolCtx => runSkill(analyzeBusinessSkill, ctx, toolCtx.data),
  })
  const researchCompetitors = defineTool({
    name: 'research-competitors',
    description: researchCompetitorsSkill.description,
    input: v.object({
      topic: v.optional(v.pipe(v.string(), v.maxLength(300))),
      maxResults: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10))),
    }),
    run: async toolCtx => runSkill(researchCompetitorsSkill, ctx, toolCtx.data),
  })
  const discoverOpportunities = defineTool({
    name: 'discover-opportunities',
    description: discoverOpportunitiesSkill.description,
    input: v.object({ focus: focusField }),
    run: async toolCtx => runSkill(discoverOpportunitiesSkill, ctx, toolCtx.data),
  })
  const createMarketingPlan = defineTool({
    name: 'create-marketing-plan',
    description: createMarketingPlanSkill.description,
    input: v.object({ horizon: v.optional(v.picklist(['30d', '90d'])), focus: focusField }),
    run: async toolCtx => runSkill(createMarketingPlanSkill, ctx, toolCtx.data),
  })
  const identifyNextAction = defineTool({
    name: 'identify-next-action',
    description: identifyNextActionSkill.description,
    input: v.object({}),
    run: async toolCtx => runSkill(identifyNextActionSkill, ctx, toolCtx.data),
  })
  const createContentIdeas = defineTool({
    name: 'create-content-ideas',
    description: createContentIdeasSkill.description,
    input: v.object({
      topic: v.optional(v.pipe(v.string(), v.maxLength(300))),
      quantity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31))),
      platforms: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(40))), v.maxLength(12))),
    }),
    run: async toolCtx => runSkill(createContentIdeasSkill, ctx, toolCtx.data),
  })
  return {
    'analyze-business': analyzeBusiness,
    'research-competitors': researchCompetitors,
    'discover-opportunities': discoverOpportunities,
    'create-marketing-plan': createMarketingPlan,
    'identify-next-action': identifyNextAction,
    'create-content-ideas': createContentIdeas,
  }
}
