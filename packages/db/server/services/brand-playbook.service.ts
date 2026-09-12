import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, desc, eq, like } from 'drizzle-orm'
import z from 'zod'
import type { ServiceResponse } from './types'
import {
  BRAND_KEYS,
  CORPUS_SECTIONS,
  entityDetails,
  type BrandKey,
  type CorpusSection,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { businessCorpusService } from './business-corpus.service'
import { businessProfileService } from './business-profile.service'

export const PLAYBOOK_ENTITY_TYPE = 'brand_playbook_edition'
export const MAX_EDITIONS = 10
/** Shape version of BrandPlaybook. v1 rows (no v2 groups) parse with empty defaults. */
export const PLAYBOOK_SCHEMA_VERSION = 2

export const BrandPlaybookSchema = z.object({
  version: z.number().default(1),
  businessName: z.string().default(''),
  identity: z.object({
    name: z.string().default(''),
    website: z.string().default(''),
    industry: z.string().default(''),
    location: z.string().default(''),
  }).default({ name: '', website: '', industry: '', location: '' }),
  audience: z.object({
    primary: z.string().default(''),
    roles: z.array(z.string()).default([]),
    problem: z.string().default(''),
    outcome: z.string().default(''),
  }).default({ primary: '', roles: [], problem: '', outcome: '' }),
  voice: z.object({
    tone: z.string().default(''),
    bannedPhrases: z.array(z.string()).default([]),
    influences: z.array(z.string()).default([]),
    examples: z.array(z.string()).default([]),
  }).default({ tone: '', bannedPhrases: [], influences: [], examples: [] }),
  positioning: z.object({
    audience: z.string().default(''),
    problem: z.string().default(''),
    differentiator: z.string().default(''),
    alternatives: z.array(z.string()).default([]),
    costOfInaction: z.string().default(''),
  }).default({ audience: '', problem: '', differentiator: '', alternatives: [], costOfInaction: '' }),
  offers: z.array(z.object({
    name: z.string(),
    transformation: z.string().default(''),
    price: z.string().default(''),
    availability: z.string().default(''),
    hidePrice: z.boolean().default(false),
  })).default([]),
  hooks: z.array(z.string()).default([]),
  competitors: z.array(z.object({
    name: z.string(),
    whyWeWin: z.string().default(''),
  })).default([]),
  testimonials: z.array(z.object({
    quote: z.string(),
    name: z.string().default(''),
    role: z.string().default(''),
  })).default([]),
  proof: z.object({
    caseStudies: z.array(z.object({
      title: z.string(),
      result: z.string().default(''),
    })).default([]),
    permission: z.string().default(''),
  }).default({ caseStudies: [], permission: '' }),
  keywords: z.object({
    primary: z.array(z.string()).default([]),
    secondary: z.array(z.string()).default([]),
  }).default({ primary: [], secondary: [] }),
  author: z.string().default(''),
  ctaLinks: z.array(z.object({
    url: z.string(),
    label: z.string().default(''),
    whenToUse: z.string().default(''),
  })).default([]),
  conversion: z.object({
    ctaRules: z.string().default(''),
  }).default({ ctaRules: '' }),
  imageStyle: z.string().default(''),
  visualStyle: z.object({
    colors: z.array(z.string()).default([]),
    fonts: z.array(z.string()).default([]),
    restrictions: z.array(z.string()).default([]),
  }).default({ colors: [], fonts: [], restrictions: [] }),
  sources: z.array(z.object({
    label: z.string(),
    kind: z.string().default('note'),
    uri: z.string().optional(),
    verified: z.boolean().default(false),
    detail: z.string().default(''),
  })).default([]),
  safety: z.object({
    neverSay: z.array(z.string()).default([]),
    verifyBeforeClaim: z.array(z.string()).default([]),
  }).default({ neverSay: [], verifyBeforeClaim: [] }),
  completion: z.object({
    filledGroups: z.array(z.string()).default([]),
    missingFields: z.array(z.string()).default([]),
    ready: z.boolean().default(false),
    updatedAt: z.string().nullable().default(null),
  }).default({ filledGroups: [], missingFields: [], ready: false, updatedAt: null }),
  metadata: z.object({
    schemaVersion: z.number().default(PLAYBOOK_SCHEMA_VERSION),
  }).default({ schemaVersion: PLAYBOOK_SCHEMA_VERSION }),
})

export const IntakeAnswerSchema = z.object({
  group: z.string().min(1),
  question: z.string().default(''),
  answer: z.string().min(1),
})

export type IntakeAnswer = z.infer<typeof IntakeAnswerSchema>

export type BrandPlaybook = z.infer<typeof BrandPlaybookSchema>
export type EditionStatus = 'draft' | 'current' | 'archived' | 'discarded'

export interface PlaybookEdition {
  id: string
  status: EditionStatus
  version: number
  hash: string
  playbook: BrandPlaybook
  publishedBy: string
  publishedAt: string | null
  updatedAt: string
  projection: { sections: number, keys: number, at: string } | null
}

interface EditionDetails {
  editionId: string
  version: number
  status: EditionStatus
  hash: string
  playbook: BrandPlaybook
  publishedBy: string
  migratedFrom?: string
  publishedAt: string | null
  updatedAt: string
  projection: PlaybookEdition['projection']
}

function editionIdFor(userId: string, businessId: string, editionId: string): string {
  return `${userId}::${businessId}::${editionId}`
}

function prefixFor(userId: string, businessId: string): string {
  return `${userId}::${businessId}::`
}

export function hashPlaybook(playbook: BrandPlaybook): string {
  return createHash('sha256').update(JSON.stringify(playbook)).digest('hex').slice(0, 16)
}

function parseEditionDetails(raw: string): EditionDetails | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as EditionDetails
  } catch {
    return null
  }
}

function toEdition(id: string, details: EditionDetails): PlaybookEdition {
  return {
    id,
    status: details.status,
    version: details.version,
    hash: details.hash,
    playbook: details.playbook,
    publishedBy: details.publishedBy,
    publishedAt: details.publishedAt,
    updatedAt: details.updatedAt,
    projection: details.projection,
  }
}

export function lines(items: string[]): string {
  return items.filter(item => item.trim().length > 0).join('\n')
}

function usable(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function listLine(label: string, items: string[], separator = ', '): string {
  return items.length > 0 ? `${label}: ${items.join(separator)}.` : ''
}

function singleLine(label: string, value: string): string {
  return usable(value) ? `${label}: ${value.trim()}.` : ''
}

function firstFilled(values: unknown[]): string {
  const hit = values.find(value => usable(value))
  return typeof hit === 'string' ? hit.trim() : ''
}

function identityLine(playbook: BrandPlaybook): string {
  const head = [playbook.identity.name, playbook.identity.industry, playbook.identity.location]
    .filter(part => usable(part))
    .join(' — ')
  return lines([head, singleLine('Site', playbook.identity.website)])
}

export function voiceGuideText(playbook: BrandPlaybook): string {
  const toneLine = singleLine('Tone', playbook.voice.tone)
  return lines([
    toneLine,
    listLine('Banned phrases', playbook.voice.bannedPhrases),
    listLine('Write like', playbook.voice.influences),
    listLine('Voice examples', playbook.voice.examples, ' | '),
    listLine('Never say', playbook.safety.neverSay, '; '),
  ])
}

export function positioningText(playbook: BrandPlaybook): string {
  const who = playbook.audience.primary.trim()
  const problem = playbook.positioning.problem.trim()
  const serveLine = who || problem
    ? `We serve ${who} who struggle with ${problem}.`
    : ''
  const diffLine = singleLine('Unlike alternatives, we', playbook.positioning.differentiator)
  return lines([
    identityLine(playbook),
    serveLine,
    singleLine('Desired outcome', playbook.audience.outcome),
    listLine('Roles', playbook.audience.roles),
    diffLine,
    listLine('Alternatives', playbook.positioning.alternatives),
    singleLine('Cost of inaction', playbook.positioning.costOfInaction),
  ])
}

export function seoKeywordsText(playbook: BrandPlaybook): string {
  return lines([
    listLine('Primary', playbook.keywords.primary),
    listLine('Secondary', playbook.keywords.secondary),
  ])
}

type PlaybookOffer = BrandPlaybook['offers'][number]

function offerLine(offer: PlaybookOffer): string {
  const base = `${offer.name} — ${offer.transformation}`.replace(/ — $/, '')
  const priced = !offer.hidePrice && usable(offer.price) ? `${base} — ${offer.price.trim()}` : base
  return usable(offer.availability) ? `${priced} (${offer.availability.trim()})` : priced
}

export function projectSections(playbook: BrandPlaybook): Record<string, string> {
  return {
    voice_guide: voiceGuideText(playbook),
    tone_examples: lines([
      ...playbook.testimonials.map(t => `“${t.quote}” — ${t.name}`),
      ...playbook.voice.examples,
    ]),
    content_hooks: lines(playbook.hooks.map((hook, index) => `Hook ${index + 1}: ${hook}`)),
    positioning: positioningText(playbook),
    offer_architecture: lines(playbook.offers.map(offerLine)),
    competitors: lines(playbook.competitors.map(c => `${c.name} — why we win: ${c.whyWeWin}`)),
    seo_keywords: seoKeywordsText(playbook),
    testimonials: lines([
      ...playbook.testimonials.map(t => `“${t.quote}” — ${t.name}, ${t.role}`),
      ...playbook.proof.caseStudies.map(c => `${c.title}: ${c.result}`),
    ]),
  }
}

export function projectKeys(playbook: BrandPlaybook): Record<string, string> {
  return {
    author: playbook.author,
    cta_links: lines([
      ...playbook.ctaLinks.map(cta =>
        `${cta.url} — ${cta.label} (use when: ${cta.whenToUse})`),
      singleLine('Rules', playbook.conversion.ctaRules),
    ]),
    image_style: lines([
      playbook.imageStyle,
      listLine('Colors', playbook.visualStyle.colors),
      listLine('Fonts', playbook.visualStyle.fonts),
      listLine('Restrictions', playbook.visualStyle.restrictions, '; '),
    ]),
  }
}

export interface PlaybookCompletion {
  filledGroups: string[]
  missingFields: string[]
  ready: boolean
}

interface CompletionCheck {
  group: string
  missing: string
  filled: (playbook: BrandPlaybook) => boolean
}

const COMPLETION_CHECKS: CompletionCheck[] = [
  { group: 'identity', missing: 'identity.name', filled: p => usable(p.identity.name) || usable(p.businessName) },
  { group: 'audience', missing: 'audience.primary', filled: p => usable(p.audience.primary) || usable(p.positioning.audience) },
  { group: 'positioning', missing: 'positioning.differentiator', filled: p => usable(p.positioning.differentiator) },
  { group: 'offers', missing: 'offers.0.name', filled: p => p.offers.length > 0 },
  { group: 'voice', missing: 'voice.tone', filled: p => usable(p.voice.tone) },
  { group: 'proof', missing: 'testimonials.0.quote', filled: p => p.testimonials.length > 0 },
  { group: 'search', missing: 'keywords.primary.0', filled: p => p.keywords.primary.length > 0 },
  { group: 'conversion', missing: 'ctaLinks.0.url', filled: p => p.ctaLinks.length > 0 || usable(p.author) },
  { group: 'visuals', missing: 'imageStyle', filled: p => usable(p.imageStyle) },
  { group: 'safety', missing: 'safety.neverSay.0', filled: p => p.safety.neverSay.length > 0 || p.safety.verifyBeforeClaim.length > 0 },
]

export function getCompletion(playbook: BrandPlaybook): PlaybookCompletion {
  const filledGroups: string[] = []
  const missingFields: string[] = []
  for (const check of COMPLETION_CHECKS) {
    if (check.filled(playbook)) filledGroups.push(check.group)
    else missingFields.push(check.missing)
  }
  return { filledGroups, missingFields, ready: missingFields.length === 0 }
}

/**
 * Bring any parsed playbook (v1 rows included) up to the canonical v2 shape.
 * Copies legacy aliases into their canonical groups; never invents content.
 */
type PlaybookGroups = Record<string, Record<string, unknown> | undefined>

const EMPTY_GROUPS: PlaybookGroups = {
  identity: { name: '', website: '', industry: '', location: '' },
  audience: { primary: '', roles: [], problem: '', outcome: '' },
  voice: { tone: '', bannedPhrases: [], influences: [], examples: [] },
  positioning: { audience: '', problem: '', differentiator: '', alternatives: [], costOfInaction: '' },
  proof: { caseStudies: [], permission: '' },
  keywords: { primary: [], secondary: [] },
  conversion: { ctaRules: '' },
  visualStyle: { colors: [], fonts: [], restrictions: [] },
  safety: { neverSay: [], verifyBeforeClaim: [] },
  completion: { filledGroups: [], missingFields: [], ready: false, updatedAt: null },
  metadata: { schemaVersion: PLAYBOOK_SCHEMA_VERSION },
}

const GROUP_KEYS = Object.keys(EMPTY_GROUPS)

function mergeGroups(playbook: BrandPlaybook): Record<string, unknown> {
  const source = playbook as unknown as PlaybookGroups
  const merged: Record<string, unknown> = { ...playbook }
  for (const key of GROUP_KEYS) {
    merged[key] = { ...EMPTY_GROUPS[key], ...(source[key] ?? {}) }
  }
  return merged
}

export function normalizePlaybook(playbook: BrandPlaybook): BrandPlaybook {
  // Zod `.default({})` bypasses inner validation, so parsed or stored rows can
  // carry partial groups. Deep-merge every group before touching fields.
  const merged = mergeGroups(playbook)
  const identity = merged.identity as BrandPlaybook['identity']
  const audience = merged.audience as BrandPlaybook['audience']
  const positioning = merged.positioning as BrandPlaybook['positioning']
  const completion = merged.completion as BrandPlaybook['completion']
  const base = {
    ...merged,
    offers: [...(playbook.offers ?? [])],
    hooks: [...(playbook.hooks ?? [])],
    competitors: [...(playbook.competitors ?? [])],
    testimonials: [...(playbook.testimonials ?? [])],
    ctaLinks: [...(playbook.ctaLinks ?? [])],
    sources: [...(playbook.sources ?? [])],
    identity: { ...identity, name: firstFilled([identity.name, playbook.businessName]) },
    audience: { ...audience, primary: firstFilled([audience.primary, positioning.audience]) },
    metadata: { schemaVersion: PLAYBOOK_SCHEMA_VERSION },
  }
  return {
    ...base,
    completion: { ...completion, ...getCompletion(base as unknown as BrandPlaybook) },
  } as BrandPlaybook
}

export function groupIntakeAnswers(answers: IntakeAnswer[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const item of answers) {
    const text = item.answer.trim()
    if (!text) continue
    const list = grouped.get(item.group) ?? []
    list.push(text)
    grouped.set(item.group, list)
  }
  return grouped
}

function parseOfferLine(text: string): BrandPlaybook['offers'][number] {
  const parts = text.split(/\s*[—\-|]\s*/).map(part => part.trim())
  return {
    name: parts[0] ?? text,
    transformation: parts[1] ?? '',
    price: parts[2] ?? '',
    availability: '',
    hidePrice: false,
  }
}

function isUrlLike(text: string): boolean {
  return /^https?:\/\//i.test(text)
}

function applyAudienceAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.positioning.audience = texts.join('; ')
  draft.audience.primary = texts[0] ?? ''
  draft.audience.problem = texts[1] ?? draft.audience.problem
  draft.audience.outcome = texts[2] ?? draft.audience.outcome
}

function applyIdentityAnswers(draft: BrandPlaybook, texts: string[]): void {
  // Explicit intake answers override profile-derived base values; omitted
  // questions leave the base draft untouched.
  const urls = texts.filter(text => isUrlLike(text))
  const rest = texts.filter(text => !isUrlLike(text))
  if (urls[0]) draft.identity.website = urls[0]
  for (const url of urls.slice(1)) {
    draft.ctaLinks.push({ url, label: 'Intake link', whenToUse: 'intake CTA' })
  }
  if (rest[0]) draft.identity.industry = rest[0]
  if (rest[1]) draft.identity.location = rest[1]
}

function applyVerifyAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.safety.verifyBeforeClaim = texts
}

function applyPositioningAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.positioning.differentiator = texts.join('; ')
}

function applyVoiceAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.voice.tone = texts[0] ?? ''
  draft.voice.influences = texts.slice(1)
}

function applyOfferAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.offers = texts.map(parseOfferLine)
}

function applyHookAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.hooks = texts
}

function applyCompetitorAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.competitors = texts.map(name => ({ name, whyWeWin: '' }))
}

function applyProofAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.testimonials = texts.map(quote => ({ quote, name: '', role: '' }))
}

function applySearchAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.keywords.primary = texts
    .flatMap(text => text.split(','))
    .map(term => term.trim())
    .filter(term => term.length > 0)
}

function applyLinkAnswers(draft: BrandPlaybook, texts: string[]): void {
  for (const text of texts) {
    if (isUrlLike(text)) {
      draft.ctaLinks.push({ url: text, label: 'Intake link', whenToUse: 'intake CTA' })
      if (!draft.identity.website) draft.identity.website = text
    } else if (!draft.author) {
      draft.author = text
    }
  }
}

function applyVisualAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.imageStyle = texts.join('\n')
}

function applySafetyAnswers(draft: BrandPlaybook, texts: string[]): void {
  draft.safety.neverSay = texts
}

const INTAKE_APPLIERS: Record<string, (draft: BrandPlaybook, texts: string[]) => void> = {
  audience: applyAudienceAnswers,
  positioning: applyPositioningAnswers,
  voice: applyVoiceAnswers,
  offers: applyOfferAnswers,
  hooks: applyHookAnswers,
  competitors: applyCompetitorAnswers,
  proof: applyProofAnswers,
  testimonials: applyProofAnswers,
  search: applySearchAnswers,
  keywords: applySearchAnswers,
  conversion: applyLinkAnswers,
  identity: applyIdentityAnswers,
  visuals: applyVisualAnswers,
  safety: applySafetyAnswers,
  verify: applyVerifyAnswers,
}

export function applyIntakeGroups(draft: BrandPlaybook, grouped: Map<string, string[]>): void {
  for (const [group, texts] of grouped) {
    INTAKE_APPLIERS[group]?.(draft, texts)
  }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function applyLegacyKnownKeys(draft: BrandPlaybook, details: Record<string, unknown>): void {
  const tone = stringField(details.tone)
  if (tone && !draft.voice.tone) draft.voice.tone = tone
  const audience = stringField(details.audience)
  if (audience) draft.positioning.audience = audience
  const differentiator = stringField(details.differentiator)
  if (differentiator) draft.positioning.differentiator = differentiator
  const author = stringField(details.author)
  if (author) draft.author = author
  const imageStyle = stringField(details.imageStyle ?? details.image_style)
  if (imageStyle) draft.imageStyle = imageStyle
  applyLegacyIdentityKeys(draft, details)
}

function applyLegacyIdentityKeys(draft: BrandPlaybook, details: Record<string, unknown>): void {
  const website = stringField(details.website)
  if (website && !draft.identity.website) draft.identity.website = website
  const industry = stringField(details.industry ?? details.category)
  if (industry && !draft.identity.industry) draft.identity.industry = industry
  const location = stringField(details.location ?? details.address)
  if (location && !draft.identity.location) draft.identity.location = location
}

function applyLegacyBrandDetails(draft: BrandPlaybook, brandDetails: unknown): void {
  if (typeof brandDetails === 'string') {
    if (!draft.voice.tone) draft.voice.tone = brandDetails
    return
  }
  if (!brandDetails || typeof brandDetails !== 'object') return
  applyLegacyKnownKeys(draft, brandDetails as Record<string, unknown>)
}

class PlaybookStore {
  private db = useDrizzle()

  async findLegacyDetails(businessId: string): Promise<string | null> {
    const rows = await this.db
      .select({ details: entityDetails.details })
      .from(entityDetails)
      .where(and(
        eq(entityDetails.entityType, 'business_details'),
        eq(entityDetails.entityId, businessId),
      ))
      .limit(1)
    if (rows.length === 0) return null
    const details = rows[0].details as unknown
    return typeof details === 'string' ? details : JSON.stringify(details ?? {})
  }

  async list(userId: string, businessId: string): Promise<EditionDetails[]> {
    const rows = await this.db
      .select()
      .from(entityDetails)
      .where(and(
        eq(entityDetails.entityType, PLAYBOOK_ENTITY_TYPE),
        like(entityDetails.entityId, `${prefixFor(userId, businessId)}%`),
      ))
      .orderBy(desc(entityDetails.updatedAt))
    const editions: EditionDetails[] = []
    for (const row of rows) {
      const details = parseEditionDetails(row.details as string)
      if (details) editions.push(details)
    }
    return editions
  }

  async save(userId: string, businessId: string, details: EditionDetails): Promise<void> {
    const entityId = editionIdFor(userId, businessId, details.editionId)
    const now = new Date()
    const existing = await this.db
      .select({ id: entityDetails.id })
      .from(entityDetails)
      .where(and(
        eq(entityDetails.entityType, PLAYBOOK_ENTITY_TYPE),
        eq(entityDetails.entityId, entityId),
      ))
      .limit(1)
    if (existing.length > 0) {
      await this.db
        .update(entityDetails)
        .set({ details: JSON.stringify(details), updatedAt: now })
        .where(eq(entityDetails.id, existing[0].id))
    } else {
      await this.db
        .insert(entityDetails)
        .values({
          id: crypto.randomUUID(),
          entityId,
          entityType: PLAYBOOK_ENTITY_TYPE,
          details: JSON.stringify(details),
          createdAt: now,
          updatedAt: now,
        })
    }
  }

  async prune(userId: string, businessId: string): Promise<void> {
    const editions = await this.list(userId, businessId)
    const stale = editions
      .filter(edition => edition.status === 'archived')
      .slice(MAX_EDITIONS)
    for (const edition of stale) {
      await this.db
        .delete(entityDetails)
        .where(and(
          eq(entityDetails.entityType, PLAYBOOK_ENTITY_TYPE),
          eq(entityDetails.entityId, editionIdFor(userId, businessId, edition.editionId)),
        ))
    }
  }
}

export class BrandPlaybookService {
  private store = new PlaybookStore()

  private async ownBusiness(userId: string, businessId: string, event?: H3Event) {
    const profile = await businessProfileService.findById(businessId, userId, event)
    if (!profile.success || !profile.data) {
      return { success: false as const, error: 'Business profile not found', code: 'NOT_FOUND' }
    }
    return {
      success: true as const,
      data: {
        profile: profile.data,
        role: (profile.data.userId === userId ? 'owner' : 'member') as 'owner' | 'member',
        ownerId: profile.data.userId,
      },
    }
  }

  async getCurrent(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<PlaybookEdition | null>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const editions = await this.store.list(owned.data.ownerId, businessId)
      const current = editions.find(edition => edition.status === 'current') ?? null
      return { success: true, data: current ? toEdition(current.editionId, current) : null }
    } catch {
      return { success: false, error: 'Failed to fetch brand playbook' }
    }
  }

  async listEditions(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<PlaybookEdition[]>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const editions = await this.store.list(owned.data.ownerId, businessId)
      return { success: true, data: editions.map(edition => toEdition(edition.editionId, edition)) }
    } catch {
      return { success: false, error: 'Failed to fetch playbook editions' }
    }
  }

  async generateDraft(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<PlaybookEdition>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const profile = owned.data.profile
      const draft: BrandPlaybook = {
        version: 1,
        businessName: profile.name,
        identity: {
          name: profile.name,
          website: profile.website ?? '',
          industry: profile.category ?? '',
          location: profile.address ?? '',
        },
        audience: { primary: '', roles: [], problem: '', outcome: '' },
        voice: { tone: '', bannedPhrases: [], influences: [], examples: [] },
        positioning: {
          audience: '',
          problem: profile.description ?? '',
          differentiator: '',
          alternatives: [],
          costOfInaction: '',
        },
        offers: [],
        hooks: [],
        competitors: [],
        testimonials: [],
        proof: { caseStudies: [], permission: '' },
        keywords: { primary: [], secondary: [] },
        author: '',
        ctaLinks: profile.website
          ? [{ url: profile.website, label: profile.name, whenToUse: 'default CTA' }]
          : [],
        conversion: { ctaRules: '' },
        imageStyle: '',
        visualStyle: { colors: [], fonts: [], restrictions: [] },
        sources: [],
        safety: { neverSay: [], verifyBeforeClaim: [] },
        completion: { filledGroups: [], missingFields: [], ready: false, updatedAt: null },
        metadata: { schemaVersion: PLAYBOOK_SCHEMA_VERSION },
      }
      return await this.createEdition(owned.data.ownerId, businessId, draft, 'draft')
    } catch {
      return { success: false, error: 'Failed to generate playbook draft' }
    }
  }

  async saveDraft(
    userId: string,
    businessId: string,
    playbook: unknown,
    event?: H3Event,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const parsed = BrandPlaybookSchema.safeParse(playbook)
      if (!parsed.success) {
        return { success: false, error: 'Invalid playbook JSON', code: 'VALIDATION_ERROR' }
      }
      const ownerId = owned.data.ownerId
      const editions = await this.store.list(ownerId, businessId)
      const normalized = normalizePlaybook(parsed.data)
      const draft = editions.find(edition => edition.status === 'draft')
      if (draft) {
        return await this.writeEdition(ownerId, businessId, {
          ...draft,
          playbook: normalized,
          hash: hashPlaybook(normalized),
          updatedAt: new Date().toISOString(),
        })
      }
      return await this.createEdition(ownerId, businessId, normalized, 'draft')
    } catch {
      return { success: false, error: 'Failed to save playbook draft' }
    }
  }

  private async loadBaseDraft(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<BrandPlaybook>> {
    const base = await this.generateDraft(userId, businessId, event)
    if (!base.success || !base.data) {
      return { success: false, error: base.error ?? 'Failed to generate playbook draft' }
    }
    const parsed = BrandPlaybookSchema.safeParse(base.data.playbook)
    if (!parsed.success) {
      return { success: false, error: 'Invalid playbook draft', code: 'VALIDATION_ERROR' }
    }
    return { success: true, data: parsed.data }
  }

  private async findMigrationDuplicate(
    ownerId: string,
    businessId: string,
    fingerprint: string,
  ): Promise<EditionDetails | null> {
    const editions = await this.store.list(ownerId, businessId)
    return editions.find(item => item.migratedFrom === fingerprint) ?? null
  }

  private applyLegacyPayload(
    draft: BrandPlaybook,
    legacy: { companyInformation?: unknown, brandDetails?: unknown },
  ): void {
    const companyInformation = stringField(legacy.companyInformation)
    if (companyInformation && !draft.positioning.problem) {
      draft.positioning.problem = companyInformation
    }
    applyLegacyBrandDetails(draft, legacy.brandDetails)
    draft.sources = [...draft.sources, { label: 'legacy_entity_details', kind: 'legacy', verified: false, detail: '' }]
  }

  private async stampMigration(
    ownerId: string,
    businessId: string,
    editionId: string,
    fingerprint: string,
  ): Promise<void> {
    const stored = (await this.store.list(ownerId, businessId))
      .find(item => item.editionId === editionId)
    if (stored) {
      await this.store.save(ownerId, businessId, { ...stored, migratedFrom: fingerprint })
    }
  }

  private async createMigratedDraft(
    userId: string,
    businessId: string,
    ownerId: string,
    legacy: { companyInformation?: unknown, brandDetails?: unknown },
    fingerprint: string,
    event?: H3Event,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    try {
      const draftRes = await this.loadBaseDraft(userId, businessId, event)
      if (!draftRes.success || !draftRes.data) {
        return { success: false, error: draftRes.error ?? 'Failed to generate playbook draft' }
      }
      this.applyLegacyPayload(draftRes.data, legacy)
      const saved = await this.saveDraft(userId, businessId, draftRes.data, event)
      if (!saved.success || !saved.data) {
        return { success: false, error: saved.error ?? 'Failed to save migrated draft' }
      }
      await this.stampMigration(ownerId, businessId, saved.data.id, fingerprint)
      return { success: true, data: saved.data }
    } catch {
      return { success: false, error: 'Failed to create migrated draft' }
    }
  }

  async createDraftFromIntake(
    userId: string,
    businessId: string,
    answers: IntakeAnswer[],
    event?: H3Event,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const draftRes = await this.loadBaseDraft(userId, businessId, event)
      if (!draftRes.success || !draftRes.data) {
        return { success: false, error: draftRes.error ?? 'Failed to generate playbook draft' }
      }
      const draft = draftRes.data
      applyIntakeGroups(draft, groupIntakeAnswers(answers))
      draft.sources = [...draft.sources, { label: 'brand_intake', kind: 'intake', verified: false, detail: '' }]
      return await this.saveDraft(userId, businessId, draft, event)
    } catch {
      return { success: false, error: 'Failed to create playbook from intake' }
    }
  }

  async restoreAsDraft(
    userId: string,
    businessId: string,
    editionId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const editions = await this.store.list(owned.data.ownerId, businessId)
      const edition = editions.find(item => item.editionId === editionId)
      if (!edition) {
        return { success: false, error: 'Playbook edition not found', code: 'NOT_FOUND' }
      }
      const parsed = BrandPlaybookSchema.safeParse(edition.playbook)
      if (!parsed.success) {
        return { success: false, error: 'Stored edition is invalid', code: 'VALIDATION_ERROR' }
      }
      return await this.createEdition(owned.data.ownerId, businessId, normalizePlaybook(parsed.data), 'draft')
    } catch {
      return { success: false, error: 'Failed to restore playbook edition' }
    }
  }

  async migrateLegacy(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ edition: PlaybookEdition | null, migrated: boolean, duplicate: boolean }>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const ownerId = owned.data.ownerId
      const raw = await this.store.findLegacyDetails(businessId)
      if (!raw) {
        return { success: true, data: { edition: null, migrated: false, duplicate: false } }
      }
      const fingerprint = hashPlaybook({ version: 0, legacy: raw } as unknown as BrandPlaybook)
      const prior = await this.findMigrationDuplicate(ownerId, businessId, fingerprint)
      if (prior) {
        return { success: true, data: { edition: toEdition(prior.editionId, prior), migrated: false, duplicate: true } }
      }
      const legacy = this.parseLegacyPayload(raw)
      const created = await this.createMigratedDraft(userId, businessId, ownerId, legacy, fingerprint, event)
      if (!created.success || !created.data) {
        return { success: false, error: created.error ?? 'Failed to create migrated draft' }
      }
      return { success: true, data: { edition: created.data, migrated: true, duplicate: false } }
    } catch {
      return { success: false, error: 'Failed to migrate legacy brand details' }
    }
  }

  async getBlockingStatus(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ brandedReady: boolean, editionId: string | null, corpus: { ready: boolean, missingSections: string[], warnings: string[] } }>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const ownerId = owned.data.ownerId
      const [editions, readiness] = await Promise.all([
        this.store.list(ownerId, businessId),
        businessCorpusService.getReadiness(businessId, ownerId),
      ])
      if (!readiness.success || !readiness.data) {
        return { success: false, error: readiness.error ?? 'Failed to assess corpus readiness' }
      }
      const current = editions.find(edition => edition.status === 'current') ?? null
      return {
        success: true,
        data: {
          brandedReady: current !== null,
          editionId: current ? current.editionId : null,
          corpus: {
            ready: readiness.data.ready,
            missingSections: readiness.data.missingSections,
            warnings: readiness.data.warnings,
          },
        },
      }
    } catch {
      return { success: false, error: 'Failed to assess brand readiness' }
    }
  }

  private parseLegacyPayload(raw: string): { companyInformation?: unknown, brandDetails?: unknown } {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed as { companyInformation?: unknown, brandDetails?: unknown }
      }
      return { companyInformation: raw }
    } catch {
      return { companyInformation: raw }
    }
  }

  async publish(
    userId: string,
    businessId: string,
    editionId: string,
    actor: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ edition: PlaybookEdition, projection: PlaybookEdition['projection'], duplicate: boolean }>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const ownerId = owned.data.ownerId
      const editions = await this.store.list(ownerId, businessId)
      const edition = editions.find(item => item.editionId === editionId)
      if (!edition) {
        return { success: false, error: 'Playbook edition not found', code: 'NOT_FOUND' }
      }
      const current = editions.find(item => item.status === 'current')
      // Self-healing: stored v1 rows are normalized before projection/storage.
      const playbook = normalizePlaybook(edition.playbook)
      if (current && current.hash === edition.hash) {
        const projection = await this.applyProjection(ownerId, businessId, playbook, 'empty-only')
        await this.repairProjection(ownerId, businessId, edition, projection)
        return {
          success: true,
          data: { edition: toEdition(edition.editionId, edition), projection, duplicate: true },
        }
      }
      const now = new Date().toISOString()
      await this.archiveCurrent(ownerId, businessId, editions, now)
      const projection = await this.applyProjection(ownerId, businessId, playbook, 'empty-only')
      const published: EditionDetails = {
        ...edition,
        playbook,
        status: 'current',
        publishedBy: actor,
        publishedAt: now,
        updatedAt: now,
        projection,
      }
      await this.store.save(ownerId, businessId, published)
      await this.store.prune(ownerId, businessId)
      return {
        success: true,
        data: { edition: toEdition(published.editionId, published), projection, duplicate: false },
      }
    } catch {
      return { success: false, error: 'Failed to publish brand playbook' }
    }
  }

  async sync(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ edition: PlaybookEdition, projection: PlaybookEdition['projection'] }>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const ownerId = owned.data.ownerId
      const editions = await this.store.list(ownerId, businessId)
      const current = editions.find(edition => edition.status === 'current')
      if (!current) {
        return { success: false, error: 'No published playbook to sync', code: 'NOT_FOUND' }
      }
      const projection = await this.applyProjection(ownerId, businessId, current.playbook, 'skip')
      await this.repairProjection(ownerId, businessId, current, projection)
      const updated = { ...current, projection, updatedAt: new Date().toISOString() }
      await this.store.save(ownerId, businessId, updated)
      return { success: true, data: { edition: toEdition(updated.editionId, updated), projection } }
    } catch {
      return { success: false, error: 'Failed to sync brand playbook' }
    }
  }

  async discard(
    userId: string,
    businessId: string,
    editionId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    try {
      const owned = await this.ownBusiness(userId, businessId, event)
      if (!owned.success) return owned
      const ownerId = owned.data.ownerId
      const editions = await this.store.list(ownerId, businessId)
      const edition = editions.find(item => item.editionId === editionId)
      if (!edition) {
        return { success: false, error: 'Playbook edition not found', code: 'NOT_FOUND' }
      }
      if (edition.status !== 'draft') {
        return { success: false, error: 'Only draft editions can be discarded', code: 'VALIDATION_ERROR' }
      }
      const discarded = { ...edition, status: 'discarded' as EditionStatus, updatedAt: new Date().toISOString() }
      await this.store.save(ownerId, businessId, discarded)
      return { success: true, data: toEdition(discarded.editionId, discarded) }
    } catch {
      return { success: false, error: 'Failed to discard playbook draft' }
    }
  }

  private async createEdition(
    userId: string,
    businessId: string,
    playbook: BrandPlaybook,
    status: EditionStatus,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    const now = new Date().toISOString()
    const details: EditionDetails = {
      editionId: crypto.randomUUID(),
      version: playbook.version,
      status,
      hash: hashPlaybook(playbook),
      playbook,
      publishedBy: '',
      publishedAt: null,
      updatedAt: now,
      projection: null,
    }
    await this.store.save(userId, businessId, details)
    return { success: true, data: toEdition(details.editionId, details) }
  }

  private async writeEdition(
    userId: string,
    businessId: string,
    details: EditionDetails,
  ): Promise<ServiceResponse<PlaybookEdition>> {
    await this.store.save(userId, businessId, details)
    return { success: true, data: toEdition(details.editionId, details) }
  }

  private async projectBrandKeys(
    userId: string,
    businessId: string,
    playbook: BrandPlaybook,
    mode: 'empty-only' | 'skip',
  ): Promise<number> {
    if (mode === 'skip') return 0
    const keys = projectKeys(playbook)
    const existing = await businessCorpusService.getBrandKeys(businessId, userId)
    const filled = new Set(
      (existing.data ?? [])
        .filter(row => row.content.trim().length > 0)
        .map(row => row.key),
    )
    let keyCount = 0
    for (const key of BRAND_KEYS) {
      const content = keys[key] ?? ''
      if (content.trim().length === 0 || filled.has(key)) continue
      await businessCorpusService.upsertBrandKey(userId, { businessId, key, content })
      keyCount += 1
    }
    return keyCount
  }

  private async archiveCurrent(
    userId: string,
    businessId: string,
    editions: EditionDetails[],
    now: string,
  ): Promise<void> {
    for (const item of editions) {
      if (item.status !== 'current') continue
      await this.store.save(userId, businessId, { ...item, status: 'archived', updatedAt: now })
    }
  }

  private async repairProjection(
    userId: string,
    businessId: string,
    edition: EditionDetails,
    projection: PlaybookEdition['projection'],
  ): Promise<void> {
    await this.store.save(userId, businessId, { ...edition, projection })
  }

  private async applyProjection(
    userId: string,
    businessId: string,
    playbook: BrandPlaybook,
    brandKeys: 'empty-only' | 'skip',
  ): Promise<PlaybookEdition['projection']> {
    const sections = projectSections(playbook)
    let sectionCount = 0
    for (const section of CORPUS_SECTIONS) {
      const content = sections[section] ?? ''
      if (content.trim().length === 0) continue
      await businessCorpusService.upsertSection(userId, { businessId, section, content })
      sectionCount += 1
    }
    const keyCount = await this.projectBrandKeys(userId, businessId, playbook, brandKeys)
    return { sections: sectionCount, keys: keyCount, at: new Date().toISOString() }
  }
}

export const brandPlaybookService = new BrandPlaybookService()
