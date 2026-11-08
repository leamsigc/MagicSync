import type { ToolDefinition } from '@flue/runtime'
import type { AgentToolContext } from '../tool-context'
import { createBoardTools } from './board.tools'
import { createContentTools } from './content.tools'
import { createDeliveryTools } from './delivery.tools'
import { createFeatureTools } from './features.tools'
import { createGoalTools } from './goal.tools'
import { createMediaTools } from './media.tools'
import { createAutoReplyTools } from './autoreply.tools'
import { createPythonTools } from './python.tools'
import { createResearchTools } from './research.tools'
import { createScrapegraphTools } from './scrapegraph.tools'
import { createSkillsTools } from './skills.tools'
import { createPublishingTools } from './publishing.tools'
import { createWorkspaceTools } from './workspace.tools'
import { createTemplateTools } from './templates.tools'
import { createWeekPlanTools } from './week-plan.tools'

/**
 * T28 — the whole Flue tool set for one run, tenant closed over by `ctx`.
 *
 * This is the **bag**, not a mount: nothing here is offered to a model on its
 * own. `./mounts` turns it into a per-agent mount through the server-owned
 * allowlist guard, so an agent never sees the full set (small-model budget, T11).
 */
export function createAgentTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    ...createBoardTools(ctx),
    ...createScrapegraphTools(ctx),
    ...createResearchTools(ctx),
    ...createContentTools(ctx),
    ...createMediaTools(ctx),
    ...createDeliveryTools(ctx),
    ...createAutoReplyTools(ctx),
    ...createFeatureTools(ctx),
    ...createWorkspaceTools(ctx),
    ...createTemplateTools(ctx),
    ...createWeekPlanTools(ctx),
    ...createPythonTools(ctx),
    ...createSkillsTools(ctx),
    ...createGoalTools(ctx),
    ...createPublishingTools(ctx),
  ]
}
