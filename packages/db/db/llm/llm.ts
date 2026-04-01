import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'

export const userLlmConfigs = sqliteTable('user_llm_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider', {
    enum: ['ollama', 'openai', 'anthropic', 'openrouter']
  }).notNull().default('ollama'),
  model: text('model').notNull().default('qwen3.5'),
  apiKey: text('api_key'), // nullable - null means use platform defaults
  apiBaseUrl: text('api_base_url'), // nullable - for custom ollama endpoints etc
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(true),
  temperature: real('temperature').notNull().default(0.7),
  maxTokens: integer('max_tokens').notNull().default(2048),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const userLlmConfigsRelations = relations(userLlmConfigs, ({ one }) => ({
  user: one(user, {
    fields: [userLlmConfigs.userId],
    references: [user.id]
  })
}))

export type UserLlmConfig = InferSelectModel<typeof userLlmConfigs>
