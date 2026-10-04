import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from './business'
import z from 'zod'

// Eight content-corpus sections (Digital Home content-corpus/ files)
export const CorpusSectionSchema = z.enum([
  'voice_guide',
  'tone_examples',
  'content_hooks',
  'positioning',
  'offer_architecture',
  'competitors',
  'seo_keywords',
  'testimonials',
])
export type CorpusSection = z.infer<typeof CorpusSectionSchema>

// Three special brand keys (Digital Home brand_context rows)
export const BrandKeySchema = z.enum(['cta_links', 'author', 'image_style'])
export type BrandKey = z.infer<typeof BrandKeySchema>

export const CORPUS_SECTIONS: CorpusSection[] = [
  'voice_guide',
  'tone_examples',
  'content_hooks',
  'positioning',
  'offer_architecture',
  'competitors',
  'seo_keywords',
  'testimonials',
]

export const BRAND_KEYS: BrandKey[] = ['cta_links', 'author', 'image_style']

export const businessCorpusSections = sqliteTable('business_corpus_sections', {
  id: text('id').primaryKey(),
  businessId: text('business_id')
    .notNull()
    .references(() => businessProfiles.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  section: text('section').notNull(),
  content: text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
})

export const businessBrandKeys = sqliteTable('business_brand_keys', {
  id: text('id').primaryKey(),
  businessId: text('business_id')
    .notNull()
    .references(() => businessProfiles.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  content: text('content').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
})

export type BusinessCorpusSection = InferSelectModel<typeof businessCorpusSections>
export type BusinessBrandKey = InferSelectModel<typeof businessBrandKeys>

export const UpsertCorpusSectionSchema = z.object({
  businessId: z.string(),
  section: CorpusSectionSchema,
  content: z.string(),
})

export const UpsertBrandKeySchema = z.object({
  businessId: z.string(),
  key: BrandKeySchema,
  content: z.string(),
})

export type UpsertCorpusSectionData = z.infer<typeof UpsertCorpusSectionSchema>
export type UpsertBrandKeyData = z.infer<typeof UpsertBrandKeySchema>
