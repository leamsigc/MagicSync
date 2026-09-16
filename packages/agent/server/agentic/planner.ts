import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { AgentComplete } from '../agent/tool-context'
import { extractJsonObject } from '../utils/run-config'
import { AgentPlanSchema, type AgentPlan, type GoalStep } from './contracts'
import { GOAL_PLAN_TEMPLATE, renderTemplate } from './prompts'
import { skillRegistry } from './skill-registry'
import './skills'

/**
 * Goal → plan. Deterministic keyword routing first (reliable, zero tokens);
 * the model is only asked to plan when no route matches, and its output is
 * always schema-validated with known skill ids before it is trusted.
 */

interface RouteEntry {
  skill: string
  title: string
  type: GoalStep['type']
  input?: Record<string, unknown>
}

interface RouteRule {
  pattern: RegExp
  build: (goal: string) => RouteEntry[]
}

function linear(entries: RouteEntry[]): GoalStep[] {
  return entries.map((entry, index) => {
    const previous = index > 0 ? entries[index - 1] : undefined
    return {
      id: entry.skill,
      skill: entry.skill,
      title: entry.title,
      type: entry.type,
      dependsOn: previous ? [previous.skill] : [],
      input: entry.input,
    }
  })
}

const ROUTE_RULES: RouteRule[] = [
  {
    pattern: /\b(idea|ideas|content|post|posts)\b/i,
    build: goal => [
      { skill: 'create-content-ideas', title: 'Generate content ideas', type: 'creation', input: { topic: goal } },
    ],
  },
  {
    pattern: /competitor/i,
    build: goal => [
      { skill: 'research-competitors', title: 'Research competitors', type: 'research', input: { topic: goal } },
      { skill: 'discover-opportunities', title: 'Find opportunities', type: 'analysis' },
    ],
  },
  {
    pattern: /\b(why|drop|dropped|decline|declined|engagement|analy[sz]e)\b/i,
    build: () => [
      { skill: 'research-business', title: 'Understand your business', type: 'research' },
      { skill: 'analyze-business', title: 'Analyze your business', type: 'analysis' },
      { skill: 'identify-next-action', title: 'Recommend next steps', type: 'planning' },
    ],
  },
  {
    pattern: /\b(seo|geo|website|google)\b/i,
    build: () => [
      { skill: 'research-business', title: 'Understand your business', type: 'research' },
      { skill: 'discover-opportunities', title: 'Find opportunities', type: 'analysis' },
      { skill: 'create-marketing-plan', title: 'Build your plan', type: 'planning' },
    ],
  },
  {
    pattern: /\b(plan|promotion|campaign|launch)\b/i,
    build: () => [
      { skill: 'research-business', title: 'Understand your business', type: 'research' },
      { skill: 'discover-opportunities', title: 'Find opportunities', type: 'analysis' },
      { skill: 'create-marketing-plan', title: 'Build your plan', type: 'planning' },
      { skill: 'identify-next-action', title: 'Recommend next steps', type: 'planning' },
    ],
  },
  {
    pattern: /\b(customer|customers|grow|growth|revenue|sales|clients?)\b/i,
    build: goal => [
      { skill: 'research-business', title: 'Understand your business', type: 'research' },
      { skill: 'research-competitors', title: 'Research competitors', type: 'research', input: { topic: goal } },
      { skill: 'discover-opportunities', title: 'Find opportunities', type: 'analysis' },
      { skill: 'create-marketing-plan', title: 'Build your plan', type: 'planning' },
      { skill: 'identify-next-action', title: 'Recommend next steps', type: 'planning' },
    ],
  },
  {
    pattern: /\b(next|opportunit|discover)\b/i,
    build: () => [
      { skill: 'research-business', title: 'Understand your business', type: 'research' },
      { skill: 'discover-opportunities', title: 'Find opportunities', type: 'analysis' },
      { skill: 'identify-next-action', title: 'Recommend next steps', type: 'planning' },
    ],
  },
]

export function routeGoal(goal: string): AgentPlan | null {
  const rule = ROUTE_RULES.find(candidate => candidate.pattern.test(goal))
  if (!rule) return null
  return { goal, summary: '', steps: linear(rule.build(goal)) }
}

function catalogText(): string {
  return skillRegistry.catalog()
    .map(entry => `- ${entry.id}: ${entry.description}`)
    .join('\n')
}

function planPrompt(goal: string): string {
  return renderTemplate(GOAL_PLAN_TEMPLATE, { catalog: catalogText(), goal })
}

function sanitizePlan(raw: unknown, goal: string): AgentPlan | null {
  const parsed = AgentPlanSchema.safeParse(raw)
  if (!parsed.success) return null
  const steps = parsed.data.steps.filter(step => skillRegistry.has(step.skill))
  if (steps.length === 0) return null
  return { goal, summary: parsed.data.summary, steps }
}

async function planFromModel(input: PlanInput, complete: AgentComplete): Promise<AgentPlan | null> {
  try {
    const text = await complete({ system: input.systemContext ?? '', prompt: planPrompt(input.goal), maxTokens: 1400 })
    const json = extractJsonObject(text)
    if (!json) return null
    return sanitizePlan(json, input.goal)
  } catch {
    return null
  }
}

export interface PlanInput {
  goal: string
  complete?: AgentComplete
  systemContext?: string
}

export async function planForGoal(input: PlanInput): Promise<ServiceResponse<AgentPlan>> {
  const routed = routeGoal(input.goal)
  if (routed) return { success: true, data: routed }
  const fromModel = input.complete ? await planFromModel(input, input.complete) : null
  if (fromModel) return { success: true, data: fromModel }
  return { success: false, error: 'Could not determine a plan for this goal', code: 'GOAL_UNPLANABLE' }
}
