import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import type { AgentToolContext } from '../tool-context'
import { createBoardTools } from './board.tools'
import { createContentTools } from './content.tools'
import { createDeliveryTools } from './delivery.tools'
import { createGoalTools } from './goal.tools'
import { createMediaTools } from './media.tools'
import { createPiiTools } from '../plugins/pii/tools'
import { createPythonTools } from './python.tools'
import { createResearchTools } from './research.tools'
import { createScrapegraphTools } from './scrapegraph.tools'
import { createSkillsTools } from './skills.tools'
import { createSubagentTools } from './subagent.tools'

/** Server-owned tool set for one agent run. */
export function createAgentTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    ...createBoardTools(ctx),
    ...createScrapegraphTools(ctx),
    ...createResearchTools(ctx),
    ...createContentTools(ctx),
    ...createMediaTools(ctx),
    ...createDeliveryTools(ctx),
    ...createPythonTools(ctx),
    ...createSkillsTools(ctx),
    ...createPiiTools(ctx),
    ...createSubagentTools(ctx),
    ...createGoalTools(ctx),
  ]
}
