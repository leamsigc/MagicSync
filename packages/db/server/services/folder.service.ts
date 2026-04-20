import { eq, and, or, sql, desc } from 'drizzle-orm'
import { type ServiceResponse, type QueryOptions } from './types'
import { knowledgeFolders, documents, type KnowledgeFolder } from '#layers/BaseDB/db/rag/rag'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface CreateFolderData {
  name: string
  parentId?: string
  path: string
  isGlobal?: boolean
}

export interface UpdateFolderData {
  name?: string
  parentId?: string
}

export class FolderService {
  private db = useDrizzle()

  async create(userId: string, data: CreateFolderData): Promise<ServiceResponse<KnowledgeFolder>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()
      const isGlobal = data.isGlobal ?? false

      const [folder] = await this.db.insert(knowledgeFolders).values({
        id,
        userId: isGlobal ? 'global' : userId,
        name: data.name,
        parentId: data.parentId || null,
        path: data.path,
        isGlobal,
        createdAt: now
      }).returning()

      return { data: folder }
    } catch (error) {
      return { error: 'Failed to create folder' }
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<KnowledgeFolder>> {
    try {
      const [folder] = await this.db
        .select()
        .from(knowledgeFolders)
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, userId)))
        .limit(1)

      if (!folder) {
        return { error: 'Folder not found', code: 'NOT_FOUND' }
      }

      return { data: folder }
    } catch (error) {
      return { error: 'Failed to fetch folder' }
    }
  }

  async findByPath(path: string, userId: string): Promise<ServiceResponse<KnowledgeFolder>> {
    try {
      const [folder] = await this.db
        .select()
        .from(knowledgeFolders)
        .where(and(eq(knowledgeFolders.path, path), eq(knowledgeFolders.userId, userId)))
        .limit(1)

      if (!folder) {
        return { error: 'Folder not found', code: 'NOT_FOUND' }
      }

      return { data: folder }
    } catch (error) {
      return { error: 'Failed to fetch folder' }
    }
  }

  async findByUser(userId: string, parentId?: string): Promise<ServiceResponse<KnowledgeFolder[]>> {
    try {
      let folders: KnowledgeFolder[]
      
      // Simple query - fetch user folders without isGlobal check
      if (parentId === undefined) {
        folders = await this.db
          .select()
          .from(knowledgeFolders)
          .where(eq(knowledgeFolders.userId, userId))
      } else {
        folders = await this.db
          .select()
          .from(knowledgeFolders)
          .where(parentId 
            ? and(eq(knowledgeFolders.userId, userId), eq(knowledgeFolders.parentId, parentId))
            : and(eq(knowledgeFolders.userId, userId))
          )
      }

      return { data: folders }
    } catch (error) {
      console.error('[FolderService.findByUser] Error:', error)
      return { error: 'Failed to fetch folders' }
    }
  }

  async findChildren(userId: string, parentId: string): Promise<ServiceResponse<KnowledgeFolder[]>> {
    try {
      const folders = await this.db
        .select()
        .from(knowledgeFolders)
        .where(and(eq(knowledgeFolders.userId, userId), eq(knowledgeFolders.parentId, parentId)))
        .orderBy(knowledgeFolders.name)

      return { data: folders }
    } catch (error) {
      return { error: 'Failed to fetch child folders' }
    }
  }

  async getRootFolders(userId: string): Promise<ServiceResponse<KnowledgeFolder[]>> {
    try {
      const folders = await this.db
        .select()
        .from(knowledgeFolders)
        .where(eq(knowledgeFolders.userId, userId))

      return { data: folders }
    } catch (error) {
      console.error('[FolderService.getRootFolders] Error:', error)
      return { error: 'Failed to fetch root folders' }
    }
  }

  async getFolderTree(userId: string): Promise<ServiceResponse<KnowledgeFolder[]>> {
    try {
      const folders = await this.db
        .select()
        .from(knowledgeFolders)
        .where(eq(knowledgeFolders.userId, userId))

      return { data: folders }
    } catch (error) {
      return { error: 'Failed to fetch folder tree' }
    }
  }

  async update(id: string, userId: string, data: UpdateFolderData): Promise<ServiceResponse<KnowledgeFolder>> {
    try {
      const [updated] = await this.db
        .update(knowledgeFolders)
        .set({
          name: data.name,
          parentId: data.parentId || null
        })
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, userId)))
        .returning()

      if (!updated) {
        return { error: 'Folder not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update folder' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<KnowledgeFolder>> {
    try {
      const [deleted] = await this.db
        .delete(knowledgeFolders)
        .where(and(eq(knowledgeFolders.id, id), eq(knowledgeFolders.userId, userId)))
        .returning()

      if (!deleted) {
        return { error: 'Folder not found', code: 'NOT_FOUND' }
      }

      return { data: deleted }
    } catch (error) {
      return { error: 'Failed to delete folder' }
    }
  }

  async moveDocumentsToFolder(folderId: string | null, documentIds: string[], userId: string): Promise<ServiceResponse<number>> {
    try {
      if (documentIds.length === 0) {
        return { data: 0 }
      }

      for (const docId of documentIds) {
        await this.db
          .update(documents)
          .set({ folderId })
          .where(and(eq(documents.id, docId), eq(documents.userId, userId)))
      }

      return { data: documentIds.length }
    } catch (error) {
      return { error: 'Failed to move documents' }
    }
  }
}

export const folderService = new FolderService()
