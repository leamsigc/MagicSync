import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'

// Legacy user-authored skills. The canonical registry (T40) lives in
// skills/registry.ts; this table backs the existing skills UI.
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  isGlobal: integer('is_global', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const skillsRelations = relations(skills, ({ one }) => ({
  user: one(user, {
    fields: [skills.userId],
    references: [user.id]
  })
}))

export type Skill = InferSelectModel<typeof skills>