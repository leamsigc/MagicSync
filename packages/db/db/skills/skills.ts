import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text, blob } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'

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

export const skillFiles = sqliteTable('skill_files', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  content: blob('content'),
  storagePath: text('storage_path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const codeExecutions = sqliteTable('code_executions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  threadId: text('thread_id'),
  code: text('code').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed']
  }).notNull().default('pending'),
  output: text('output'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' })
})

export const sandboxFiles = sqliteTable('sandbox_files', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').references(() => codeExecutions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const skillsRelations = relations(skills, ({ one, many }) => ({
  user: one(user, {
    fields: [skills.userId],
    references: [user.id]
  }),
  files: many(skillFiles)
}))

export const skillFilesRelations = relations(skillFiles, ({ one }) => ({
  skill: one(skills, {
    fields: [skillFiles.skillId],
    references: [skills.id]
  }),
  user: one(user, {
    fields: [skillFiles.userId],
    references: [user.id]
  })
}))

export const codeExecutionsRelations = relations(codeExecutions, ({ one }) => ({
  user: one(user, {
    fields: [codeExecutions.userId],
    references: [user.id]
  })
}))

export const sandboxFilesRelations = relations(sandboxFiles, ({ one }) => ({
  execution: one(codeExecutions, {
    fields: [sandboxFiles.executionId],
    references: [codeExecutions.id]
  }),
  user: one(user, {
    fields: [sandboxFiles.userId],
    references: [user.id]
  })
}))

export type Skill = InferSelectModel<typeof skills>
export type SkillFile = InferSelectModel<typeof skillFiles>
export type CodeExecution = InferSelectModel<typeof codeExecutions>
export type SandboxFile = InferSelectModel<typeof sandboxFiles>