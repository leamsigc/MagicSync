import type { H3Event } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
import { documentService, chunkService } from '#layers/BaseDB/server/services/document.service'
import { agentService } from '#layers/BaseDB/server/services/agent.service'
import { skillService } from '#layers/BaseDB/server/services/skill.service'
import { folderService } from '#layers/BaseDB/server/services/folder.service'
import type { ChatThread, ChatMessage, UserLlmConfig, Document, DocumentChunk, AgentSession, Skill, SkillFile, KnowledgeFolder } from '#layers/BaseDB/db/schema'

export type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof checkUserIsLogin>>>

export type LlmJwtContext = {
  userId: string
  email: string
  config: UserLlmConfig | null
  token: string
}

export type ChatThreadInput = {
  title: string
}

export type ChatMessageInput = {
  threadId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, unknown>
}

export type DocumentCreateInput = {
  filename: string
  originalName: string
  mimeType: string
  size: number
  storagePath: string
  contentHash?: string
  folderId?: string | null
  metadata?: Record<string, unknown>
}

export type ChunkCreateInput = {
  documentId: string
  userId: string
  chunkIndex: number
  content: string
  contentHash?: string
  embedding?: number[]
  tokenCount?: number
  metadata?: Record<string, unknown>
}

export type AgentSessionInput = {
  id: string
  userId: string
  parentMessageId: string
  threadId?: string
  task: string
  taskType?: string
  maxSteps?: number
  metadata?: Record<string, unknown>
}

export type SkillCreateInput = {
  name: string
  description: string
  instructions: string
  isGlobal?: boolean
  files?: Array<{ filename: string; content: string }>
}

export type FolderCreateInput = {
  name: string
  parentId?: string
  path?: string
  isGlobal?: boolean
}

export class AiToolsFacadeService {
  async authenticate(event: H3Event): Promise<AuthenticatedUser> {
    return checkUserIsLogin(event)
  }

  async getLlmJwtContext(userId: string, email: string): Promise<ServiceResponse<LlmJwtContext>> {
    try {
      const configResult = await userLlmConfigService.getDefaultConfig(userId)
      const config = configResult.data ?? null
      const token = createLlmJwt(userId, email, config)
      return { data: { userId, email, config, token } }
    } catch (error) {
      return { error: 'Failed to build LLM JWT context' }
    }
  }

  async createThread(userId: string, input: ChatThreadInput): Promise<ServiceResponse<ChatThread>> {
    return chatService.createThread(userId, input)
  }

  async getThreads(userId: string): Promise<ServiceResponse<ChatThread[]>> {
    return chatService.getThreads(userId)
  }

  async getThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    return chatService.getThread(threadId, userId)
  }

  async deleteThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    return chatService.deleteThread(threadId, userId)
  }

  async addMessage(userId: string, input: ChatMessageInput): Promise<ServiceResponse<ChatMessage>> {
    return chatService.addMessage({ ...input, userId })
  }

  async getMessages(threadId: string, userId: string, options?: { limit?: number; before?: string; after?: string }): Promise<ServiceResponse<ChatMessage[]>> {
    return chatService.getMessages(threadId, userId, options)
  }

  async createDocument(userId: string, input: DocumentCreateInput): Promise<ServiceResponse<Document>> {
    return documentService.create(userId, input)
  }

  async getDocument(id: string, userId: string): Promise<ServiceResponse<Document>> {
    return documentService.findById(id, userId)
  }

  async getDocuments(userId: string, options?: { page?: number; limit?: number }): Promise<ServiceResponse<Document[]>> {
    const result = await documentService.findByUser(userId, {
      pagination: { page: options?.page ?? 1, limit: options?.limit ?? 20 }
    })
    if (result.error) {
      return { error: result.error }
    }
    return { data: result.data }
  }

  async deleteDocument(id: string, userId: string): Promise<ServiceResponse<Document>> {
    return documentService.delete(id, userId)
  }

  async updateDocumentStatus(id: string, userId: string, status: Document['status'], errorMessage?: string): Promise<ServiceResponse<Document>> {
    return documentService.updateStatus(id, userId, status, errorMessage)
  }

  async updateDocumentMetadata(id: string, userId: string, metadata: Record<string, unknown>): Promise<ServiceResponse<Document>> {
    return documentService.updateMetadata(id, userId, metadata)
  }

  async updateDocumentContentHash(id: string, userId: string, contentHash: string): Promise<ServiceResponse<Document>> {
    return documentService.updateContentHash(id, userId, contentHash)
  }

  async updateDocumentChunkCount(id: string, userId: string, chunkCount: number): Promise<ServiceResponse<Document>> {
    return documentService.updateChunkCount(id, userId, chunkCount)
  }

  async updateDocumentFolder(id: string, userId: string, folderId: string | null): Promise<ServiceResponse<Document>> {
    return documentService.updateFolder(id, userId, folderId)
  }

  async checkDocumentDuplicate(contentHash: string, userId: string): Promise<ServiceResponse<Document>> {
    return documentService.findByContentHash(contentHash, userId)
  }

  async createChunks(chunks: ChunkCreateInput[]): Promise<ServiceResponse<number>> {
    return chunkService.createMany(chunks)
  }

  async getChunksByDocument(documentId: string): Promise<ServiceResponse<DocumentChunk[]>> {
    return chunkService.findByDocument(documentId)
  }

  async deleteChunksByIds(ids: string[]): Promise<ServiceResponse<number>> {
    return chunkService.deleteByIds(ids)
  }

  async deleteChunksByDocument(documentId: string): Promise<ServiceResponse<number>> {
    return chunkService.deleteByDocument(documentId)
  }

  async searchChunks(userId: string, embedding: number[], limit: number, filters?: { documentId?: string; metadataKey?: string; metadataValue?: string }): Promise<ServiceResponse<Array<{ content: string; documentId: string; similarity: number; metadata: Record<string, unknown> | null }>>> {
    return chunkService.search(userId, embedding, limit, filters)
  }

  async createAgentSession(input: AgentSessionInput): Promise<ServiceResponse<AgentSession>> {
    return agentService.create(input)
  }

  async getAgentSession(sessionId: string, userId: string): Promise<ServiceResponse<AgentSession>> {
    return agentService.getById(sessionId, userId)
  }

  async listAgentSessions(userId: string, parentMessageId?: string): Promise<ServiceResponse<AgentSession[]>> {
    return agentService.listByUser(userId, parentMessageId)
  }

  async updateAgentSession(sessionId: string, userId: string, data: { status?: 'created' | 'running' | 'completed' | 'failed'; stepCount?: number; result?: string; errorMessage?: string; metadata?: Record<string, unknown> }): Promise<ServiceResponse<AgentSession>> {
    return agentService.update(sessionId, userId, data)
  }

  async deleteAgentSession(sessionId: string, userId: string): Promise<ServiceResponse<AgentSession>> {
    return agentService.delete(sessionId, userId)
  }

  async createSkill(userId: string, input: SkillCreateInput): Promise<ServiceResponse<Skill>> {
    return skillService.create(userId, { name: input.name, description: input.description, instructions: input.instructions, isGlobal: input.isGlobal })
  }

  async getSkills(userId: string): Promise<ServiceResponse<Skill[]>> {
    return skillService.findByUser(userId)
  }

  async getSkill(id: string, userId: string): Promise<ServiceResponse<Skill>> {
    return skillService.findById(id, userId)
  }

  async updateSkill(id: string, userId: string, data: Partial<SkillCreateInput>): Promise<ServiceResponse<Skill>> {
    return skillService.update(id, userId, data)
  }

  async deleteSkill(id: string, userId: string): Promise<ServiceResponse<Skill>> {
    return skillService.delete(id, userId)
  }

  async getSkillCatalog(userId: string): Promise<ServiceResponse<Array<{ name: string; description: string }>>> {
    return skillService.getCatalog(userId)
  }

  async createSkillFile(userId: string, data: { skillId: string; filename: string; content: string }): Promise<ServiceResponse<SkillFile>> {
    return skillService.create(userId, data)
  }

  async getSkillFiles(skillId: string): Promise<ServiceResponse<SkillFile[]>> {
    return skillService.findBySkill(skillId)
  }

  async createFolder(userId: string, input: FolderCreateInput): Promise<ServiceResponse<KnowledgeFolder>> {
    return folderService.create(userId, {
      name: input.name,
      parentId: input.parentId ?? null,
      path: input.path ?? `/${input.name}`,
      isGlobal: input.isGlobal ?? false,
    })
  }

  async getFolders(userId: string, parentId?: string): Promise<ServiceResponse<KnowledgeFolder[]>> {
    return folderService.findByUser(userId, parentId)
  }

  async getFolder(id: string, userId: string): Promise<ServiceResponse<KnowledgeFolder>> {
    return folderService.findById(id, userId)
  }

  async getGlobalFolder(id: string): Promise<ServiceResponse<KnowledgeFolder>> {
    return folderService.findById(id, 'global')
  }

  async getFolderTree(userId: string): Promise<ServiceResponse<KnowledgeFolder[]>> {
    return folderService.getFolderTree(userId)
  }

  async updateFolder(id: string, userId: string, data: { name?: string; parentId?: string }): Promise<ServiceResponse<KnowledgeFolder>> {
    return folderService.update(id, userId, data)
  }

  async deleteFolder(id: string, userId: string): Promise<ServiceResponse<KnowledgeFolder>> {
    return folderService.delete(id, userId)
  }

  async moveDocumentsToFolder(folderId: string | null, documentIds: string[], userId: string): Promise<ServiceResponse<number>> {
    return folderService.moveDocumentsToFolder(folderId, documentIds, userId)
  }

  async getLlmConfigs(userId: string): Promise<ServiceResponse<UserLlmConfig[]>> {
    return userLlmConfigService.getConfigs(userId)
  }

  async getDefaultLlmConfig(userId: string): Promise<ServiceResponse<UserLlmConfig>> {
    return userLlmConfigService.getDefaultConfig(userId)
  }

  async createLlmConfig(userId: string, data: { provider: 'ollama' | 'openai' | 'anthropic' | 'openrouter'; model: string; apiKey?: string | null; apiBaseUrl?: string | null; isDefault?: boolean; temperature?: number; maxTokens?: number }): Promise<ServiceResponse<UserLlmConfig>> {
    return userLlmConfigService.createConfig(userId, data)
  }

  async updateLlmConfig(userId: string, configId: string, data: { provider?: 'ollama' | 'openai' | 'anthropic' | 'openrouter'; model?: string; apiKey?: string | null; apiBaseUrl?: string | null; isDefault?: boolean; temperature?: number; maxTokens?: number }): Promise<ServiceResponse<UserLlmConfig>> {
    return userLlmConfigService.updateConfig(userId, configId, data)
  }

  async deleteLlmConfig(userId: string, configId: string): Promise<ServiceResponse<UserLlmConfig>> {
    return userLlmConfigService.deleteConfig(userId, configId)
  }

  async setDefaultLlmConfig(userId: string, configId: string): Promise<ServiceResponse<UserLlmConfig>> {
    return userLlmConfigService.setDefault(userId, configId)
  }
}

export const aiToolsFacade = new AiToolsFacadeService()
