import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text, blob } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'

// Knowledge base folders for hierarchical navigation
export const knowledgeFolders = sqliteTable('knowledge_folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: text('parent_id').references(() => knowledgeFolders.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Documents uploaded for RAG
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(),
  contentHash: text('content_hash'),
  status: text('status', {
    enum: ['pending', 'processing', 'completed', 'failed']
  }).notNull().default('pending'),
  errorMessage: text('error_message'),
  chunkCount: integer('chunk_count').default(0),
  metadata: text('metadata'), // JSON: page count, author, etc.
  folderId: text('folder_id').references(() => knowledgeFolders.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Chunks with vector embeddings (Turso vector storage)
export const documentChunks = sqliteTable('document_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash'),
  embedding: blob('embedding'), // Vector stored as float32 blob for Turso vector_distance_cos
  tokenCount: integer('token_count'),
  metadata: text('metadata'), // JSON: page number, section, etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Chat threads
export const chatThreads = sqliteTable('chat_threads', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  lastMessageAt: integer('last_message_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Chat messages
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => chatThreads.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON: retrieved chunk ids, trace url, etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Relations
export const knowledgeFoldersRelations = relations(knowledgeFolders, ({ one, many }) => ({
  user: one(user, {
    fields: [knowledgeFolders.userId],
    references: [user.id]
  }),
  parent: one(knowledgeFolders, {
    fields: [knowledgeFolders.parentId],
    references: [knowledgeFolders.id]
  }),
  documents: many(documents),
  children: many(knowledgeFolders, {
    relationName: 'child_folders'
  })
}))

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(user, {
    fields: [documents.userId],
    references: [user.id]
  }),
  folder: one(knowledgeFolders, {
    fields: [documents.folderId],
    references: [knowledgeFolders.id]
  }),
  chunks: many(documentChunks)
}))

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id]
  }),
  user: one(user, {
    fields: [documentChunks.userId],
    references: [user.id]
  })
}))

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  user: one(user, {
    fields: [chatThreads.userId],
    references: [user.id]
  }),
  messages: many(chatMessages)
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [chatMessages.threadId],
    references: [chatThreads.id]
  })
}))

// Agent sessions (sub-agents)
export const agentSessions = sqliteTable('agent_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  parentMessageId: text('parent_message_id').notNull(),
  threadId: text('thread_id').references(() => chatThreads.id, { onDelete: 'cascade' }),
  task: text('task').notNull(),
  status: text('status', {
    enum: ['created', 'running', 'completed', 'failed']
  }).notNull().default('created'),
  taskType: text('task_type'), // research, analysis, multi-step, complex
  maxSteps: integer('max_steps').notNull().default(10),
  stepCount: integer('step_count').notNull().default(0),
  result: text('result'),
  errorMessage: text('error_message'),
  metadata: text('metadata'), // JSON: orchestrator decision, confidence, etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const agentSessionsRelations = relations(agentSessions, ({ one }) => ({
  user: one(user, {
    fields: [agentSessions.userId],
    references: [user.id]
  }),
  thread: one(chatThreads, {
    fields: [agentSessions.threadId],
    references: [chatThreads.id]
  })
}))

// Types
export type Document = InferSelectModel<typeof documents>
export type DocumentChunk = InferSelectModel<typeof documentChunks>
export type ChatThread = InferSelectModel<typeof chatThreads>
export type ChatMessage = InferSelectModel<typeof chatMessages>
export type AgentSession = InferSelectModel<typeof agentSessions>
export type KnowledgeFolder = InferSelectModel<typeof knowledgeFolders>
