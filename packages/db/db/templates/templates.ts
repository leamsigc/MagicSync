import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'

export const TemplateType = ['EMAIL', 'IMAGES', 'CHAT', 'VARIABLE'] as const

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type', { enum: TemplateType }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  isPublic: integer('isPublic', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', {
    mode: 'timestamp'
  }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  updatedAt: integer('updatedAt', {
    mode: 'timestamp'
  }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
})

export const templateAssets = sqliteTable('template_assets', {
  id: text('id').primaryKey(),
  templateId: text('templateId').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  createdAt: integer('createdAt', {
    mode: 'timestamp'
  }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
})

export type Template = InferSelectModel<typeof templates>
export type TemplateAsset = InferSelectModel<typeof templateAssets>
