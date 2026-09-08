import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'

export const NOTIFICATION_EVENTS = ['general', 'post_failed', 'comment_reply', 'bulk_done', 'invite', 'token_expiring', 'autoreply'] as const

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export const notifications = sqliteTable('notifications', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    event: text('event').notNull().default('general'),
    type: text('type', { enum: ['info', 'success', 'warning', 'error'] }).notNull().default('info'),
    title: text('title').notNull(),
    message: text('message').notNull(),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    actionUrl: text('action_url'),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export type Notification = InferSelectModel<typeof notifications>

export const notificationPreferences = sqliteTable('notification_preferences', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    event: text('event').notNull().default('general'),
    inApp: integer('in_app', { mode: 'boolean' }).notNull().default(true),
    email: integer('email', { mode: 'boolean' }).notNull().default(true),
    mutedUntil: integer('muted_until', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, (table) => [
    unique('notification_prefs_user_event_uniq').on(table.userId, table.event),
])

export type NotificationPreference = InferSelectModel<typeof notificationPreferences>
