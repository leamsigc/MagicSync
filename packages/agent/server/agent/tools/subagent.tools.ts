import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { Agent, type AgentTool } from '@earendil-works/pi-agent-core'
import { AGENT_PROMPTS } from '../prompts'
import { findBundledSkill, type BundledSkill } from '../skills'
import { delegatableAgents, findPredefinedAgent, type PredefinedAgent } from '../agents'
import type { AgentToolContext } from '../tool-context'

const SUBAGENT_MAX_TURNS = 6

function subagentPrompt(agent: PredefinedAgent): string {
  const skillBlocks = agent.forceSkills
    .map(slug => findBundledSkill(slug))
    .filter((skill): skill is BundledSkill => skill !== undefined)
    .map(skill => `# Loaded skill: ${skill.name}\n\n${skill.body}`)
  return [AGENT_PROMPTS.base, AGENT_PROMPTS[agent.prompt], ...skillBlocks].join('\n\n')
}

function availableAgentsText(): string {
  return delegatableAgents().map(agent => `${agent.name} (${agent.description})`).join('; ')
}

interface DelegatedRun {
  text: string
  turns: number
}

/**
 * Run a predefined agent in-process on @earendil-works/pi-agent-core with an
 * isolated transcript and only the tools/skills its registry entry allows.
 */
async function runDelegatedAgent(
  ctx: AgentToolContext,
  agent: PredefinedAgent,
  task: string,
  signal: AbortSignal | undefined,
  onUpdate: ((partial: { content: Array<{ type: 'text', text: string }>, details: unknown }) => void) | undefined,
): Promise<DelegatedRun> {
  if (!ctx.modelRuntime || !ctx.model) {
    throw new Error('SUBAGENT_UNAVAILABLE: no model runtime is configured for this run')
  }
  const tools = (ctx.subagentTools ?? [])
    .filter(tool => tool.name !== 'subagent' && agent.tools.includes(tool.name))
  const run: DelegatedRun = { text: '', turns: 0 }
  const child = new Agent({
    initialState: {
      systemPrompt: subagentPrompt(agent),
      model: ctx.model,
      tools: tools as unknown as AgentTool<any>[],
    },
    streamFn: ctx.modelRuntime.streamSimple.bind(ctx.modelRuntime),
    shouldStopAfterTurn: () => run.turns >= SUBAGENT_MAX_TURNS,
    toolExecution: 'parallel',
  })
  const unsubscribe = child.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      run.text += event.assistantMessageEvent.delta
    }
    if (event.type === 'turn_end') {
      run.turns += 1
      onUpdate?.({
        content: [{ type: 'text', text: run.text.slice(-1500) || '(running...)' }],
        details: { agent: agent.name, turns: run.turns },
      })
    }
  })
  if (signal) {
    if (signal.aborted) child.abort()
    else signal.addEventListener('abort', () => child.abort(), { once: true })
  }
  try {
    await child.prompt(task)
  }
  finally {
    unsubscribe()
  }
  return run
}

export function createSubagentTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'subagent',
      label: 'Delegate to a specialist agent',
      description: `Delegate a self-contained task to a predefined specialist agent with an isolated context. Available agents: ${availableAgentsText()}`,
      parameters: Type.Object({
        agent: Type.String({ description: `Agent name (${delegatableAgents().map(entry => entry.name).join(', ')})` }),
        task: Type.String({ description: 'Self-contained task: context, what to produce, and the exact output needed' }),
      }),
      execute: async (_toolCallId, params, signal, onUpdate) => {
        const agent = findPredefinedAgent(params.agent)
        if (!agent || agent.name === 'orchestrator') {
          throw new Error(`SUBAGENT_UNKNOWN: unknown agent "${params.agent}". Available: ${delegatableAgents().map(entry => entry.name).join(', ')}`)
        }
        const run = await runDelegatedAgent(ctx, agent, params.task, signal, onUpdate)
        return {
          content: [{ type: 'text' as const, text: run.text.trim() || '(no output)' }],
          details: { agent: agent.name, turns: run.turns, truncated: run.turns >= SUBAGENT_MAX_TURNS },
        }
      },
    }),
  ]
}
