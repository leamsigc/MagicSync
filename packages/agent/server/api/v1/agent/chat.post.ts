import { z } from 'zod'
import type { H3Event } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { agentRunnerService } from '#layers/BaseAgent/server/services/agent-runner.service'
import { buildAgentRunConfig, runConfigErrorStatus } from '#layers/BaseAgent/server/utils/run-config'
import { AGENT_TOOL_NAMES } from '#layers/BaseAgent/server/agent/tool-catalog'
import { BUNDLED_SKILLS } from '#layers/BaseAgent/server/flue/skills'
import { isSpecialistProfileName } from '#layers/BaseAgent/server/flue/specialists'

const ChatRequestSchema = z.object({
  businessId: z.string().min(1),
  message: z.string().min(1).max(20000),
  threadId: z.string().min(1).nullish(),
  sessionId: z.string().min(1).nullish(),
  cardId: z.string().min(1).nullish(),
  agentName: z.string().min(1).max(80).nullish(),
  allowedTools: z.array(z.string().min(1).max(80)).max(40).nullish(),
  skillSlugs: z.array(z.string().min(1).max(80)).max(12).nullish(),
  registeredSkillIds: z.array(z.string().min(1).max(80)).max(12).nullish(),
  /** Structural revision target — ids travel here, never as prose in `message`. */
  carouselRevision: z.object({
    artifactId: z.string().min(1).max(120),
    slideIds: z.array(z.string().min(1).max(120)).max(10).nullish(),
  }).nullish(),
})

type ChatRequest = z.infer<typeof ChatRequestSchema>

function draftCaptionOf(output: unknown): string {
  const record = (typeof output === 'string' ? safeParseOutput(output) : output) as Record<string, unknown> | null
  const caption = record?.caption
  return typeof caption === 'string' ? caption : ''
}

function safeParseOutput(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  }
  catch {
    return null
  }
}

function isCarouselIntent(message: string): boolean {
  return /\b(create|make|generate|build|design|write)\b[\s\S]{0,80}\bcarousels?\b|\bcarousels?\b[\s\S]{0,80}\b(create|make|generate|build|design|write)\b/i.test(message)
}

function isCarouselRevisionIntent(message: string): boolean {
  if (isCarouselIntent(message)) return false
  return /\b(revise|edit|change|update|tweak|swap|rewrite|regenerate|redo|fix)\b/i.test(message)
    && /\b(carousel|slide|slides|deck|page|pages|cover)\b/i.test(message)
}

function isSlideCountIntent(message: string): boolean {
  return /\b(slide count|number of slides|more slides|fewer slides|less slides|add (a )?slides?|remove (a )?slides?|drop (a )?slides?)\b/i.test(message)
}

function carouselHarnessContext(message: string): string {
  return [
    'Harness mode: carousel request detected.',
    'Use generate_carousel exactly once. The harness will supply the original request; do not use sourceId, itemId, board tools, or any follow-up tool call.',
    'Do not create board cards, move board items, create posts, schedule, publish, research separately, or call any other tool.',
    'The carousel workflow owns research and generation internally and returns the preview artifact for chat review. The default deck is 10 slides so the preview matches the 5-column reference layout.',
    `Original user request: ${message.slice(0, 12000)}`,
  ].join('\n')
}

function carouselRevisionContext(
  revision: { artifactId: string, slideIds?: string[] | null },
  message: string,
  structural = false,
): string {
  const scope = revision.slideIds?.length
    ? `Revise ONLY these slide ids: ${revision.slideIds.join(', ')}. Every other slide must be returned unchanged.`
    : structural
      ? 'The request is about the deck structure (slide count/order): add or remove slides as needed and return the full updated deck.'
      : 'Revise only the slide(s) the request names. If it names none, ask which slide — never rewrite the whole deck.'
  return [
    'Harness mode: carousel revision detected.',
    `Call revise_carousel exactly once with artifactId ${revision.artifactId}.`,
    'Pass the target slide ids in slideIds so only those slides change.',
    scope,
    'Do not call generate_carousel, do not create a new carousel, do not touch board cards, and do not schedule or publish.',
    `Requested changes: ${message.slice(0, 4000)}`,
  ].join('\n')
}

type CarouselResolution =
  | { kind: 'none', allowedTools: string[] | undefined }
  | { kind: 'generate', allowedTools: string[], systemContext: string, carouselRequest: string }
  | { kind: 'revise', allowedTools: string[], systemContext: string, carouselTarget: { artifactId: string, slideIds: string[] } }

function resolveCarousel(
  body: ChatRequest,
  requestedTools: string[] | undefined,
  latestCarouselId: string | null,
): CarouselResolution {
  if (body.carouselRevision) {
    return {
      kind: 'revise',
      allowedTools: ['revise_carousel'],
      systemContext: carouselRevisionContext(body.carouselRevision, body.message),
      carouselTarget: { artifactId: body.carouselRevision.artifactId, slideIds: body.carouselRevision.slideIds ?? [] },
    }
  }
  if (isCarouselIntent(body.message)) {
    return {
      kind: 'generate',
      allowedTools: ['generate_carousel'],
      systemContext: carouselHarnessContext(body.message),
      carouselRequest: body.message,
    }
  }
  if (latestCarouselId && isCarouselRevisionIntent(body.message)) {
    return {
      kind: 'revise',
      allowedTools: ['revise_carousel'],
      systemContext: carouselRevisionContext({ artifactId: latestCarouselId, slideIds: [] }, body.message, isSlideCountIntent(body.message)),
      carouselTarget: { artifactId: latestCarouselId, slideIds: [] },
    }
  }
  return { kind: 'none', allowedTools: requestedTools }
}

async function latestCarouselArtifact(userId: string, businessId: string, event: H3Event): Promise<string | null> {
  const listed = await contentArtifactService.listArtifacts(userId, { businessId }, event)
  if (!listed.success) return null
  return listed.data.find(item => item.outputKind === 'carousel')?.id ?? null
}

/**
 * Authoritative read-only card snapshot appended to the system prompt so the
 * agent can act on the card the user is viewing (revise_draft included).
 * Never fails the chat: unknown cards simply contribute no context.
 */
async function cardSupplement(userId: string, businessId: string, cardId: string, event: H3Event): Promise<string | null> {
  const card = await contentBoardService.get(userId, businessId, cardId, event)
  if (!card.success) return null
  const lines = [
    `Card ${card.data.id} "${card.data.title}" state=${card.data.state} platforms=[${(card.data.platforms ?? []).join(', ')}]`,
  ]
  if (card.data.brief) lines.push(`Brief: ${card.data.brief.slice(0, 800)}`)
  if (card.data.artifactId) {
    const artifact = await contentArtifactService.getArtifact(userId, card.data.artifactId, businessId, event)
    if (artifact.success) lines.push(`Draft caption: ${draftCaptionOf(artifact.data.output).slice(0, 1200)}`)
  }
  lines.push(`When the user asks to change this card, call revise_draft with itemId ${card.data.id}.`)
  return `Card context (authoritative snapshot, read-only):\n${lines.join('\n')}`
}

async function resolveThread(userId: string, body: ChatRequest) {
  if (body.threadId) return chatService.getThread(body.threadId, userId)
  return chatService.createThread(userId, { title: body.message.slice(0, 80) || 'New Chat' })
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = ChatRequestSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const runConfig = await buildAgentRunConfig(user.id, body.businessId, event, log)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }

  const thread = await resolveThread(user.id, body)
  if (!thread.success) {
    throw createError({ statusCode: 500, statusMessage: thread.error })
  }
  setResponseHeader(event, 'X-Thread-Id', thread.data.id)

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const supplement = body.cardId ? await cardSupplement(user.id, body.businessId, body.cardId, event) : null
  const toolNames = new Set(AGENT_TOOL_NAMES)
  const requestedTools = body.allowedTools?.filter(tool => toolNames.has(tool))
  const latestCarouselId = !body.carouselRevision && isCarouselRevisionIntent(body.message)
    ? await latestCarouselArtifact(user.id, body.businessId, event)
    : null
  const carousel = resolveCarousel(body, requestedTools, latestCarouselId)
  const isCarouselTurn = carousel.kind !== 'none'
  const systemContext = [
    runConfig.data.systemContext,
    supplement,
    carousel.kind === 'none' ? null : carousel.systemContext,
  ].filter(Boolean).join('\n\n')

  const agentName = !isCarouselTurn && body.agentName && isSpecialistProfileName(body.agentName)
    ? body.agentName
    : undefined
  const allowedTools = carousel.allowedTools
  const skillSlugs = new Set(BUNDLED_SKILLS.map(skill => skill.slug))
  const extraSkillSlugs = body.skillSlugs?.filter(slug => skillSlugs.has(slug))
  const extraRegisteredSkillIds = body.registeredSkillIds?.length ? body.registeredSkillIds : undefined

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      await agentRunnerService.run({
        userId: user.id,
        businessId: body.businessId,
        threadId: thread.data.id,
        sessionId: body.sessionId ?? null,
        text: body.message,
        agentName,
        allowedTools,
        extraSkillSlugs,
        extraRegisteredSkillIds,
        systemContext,
        provider: runConfig.data.provider,
        model: runConfig.data.modelId,
        apiKey: runConfig.data.apiKey,
        apiBaseUrl: runConfig.data.apiBaseUrl,
        log,
        toolContext: {
          userId: user.id,
          businessId: body.businessId,
          event,
          log,
          carouselRequest: carousel.kind === 'generate' ? carousel.carouselRequest : undefined,
          carouselTarget: carousel.kind === 'revise' ? carousel.carouselTarget : undefined,
        },
        maxToolCalls: isCarouselTurn ? 40 : undefined,
        singleToolCall: isCarouselTurn,
      }, send)
      controller.close()
    },
  })

  return sendStream(event, stream)
})
