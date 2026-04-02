import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { type ServiceResponse, type PaginatedResponse, type QueryOptions } from './types'
import { documents, documentChunks, type Document, type DocumentChunk } from '#layers/BaseDB/db/schema'
import { useDrizzle, tursoClient } from '#layers/BaseDB/server/utils/drizzle'
import { searchService, type SearchResult } from './search.service'

export interface CreateDocumentData {
  filename: string
  originalName: string
  mimeType: string
  size: number
  storagePath: string
  contentHash?: string
  metadata?: Record<string, any>
  folderId?: string
}

export interface CreateChunkData {
  documentId: string
  userId: string
  chunkIndex: number
  content: string
  contentHash?: string
  embedding?: number[]
  tokenCount?: number
  metadata?: Record<string, any>
}

export class DocumentService {
  private db = useDrizzle()

  async create(userId: string, data: CreateDocumentData): Promise<ServiceResponse<Document>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      const [doc] = await this.db.insert(documents).values({
        id,
        userId,
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: now,
        updatedAt: now,
      }).returning()

      return { data: doc }
    } catch (error) {
      return { error: 'Failed to create document' }
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<Document>> {
    try {
      const [doc] = await this.db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .limit(1)

      if (!doc) {
        return { error: 'Document not found', code: 'NOT_FOUND' }
      }

      return { data: doc }
    } catch (error) {
      return { error: 'Failed to fetch document' }
    }
  }

  async findByUser(userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Document>> {
    try {
      const { pagination = { page: 1, limit: 20 } } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 20)

      const docList = await this.db
        .select()
        .from(documents)
        .where(eq(documents.userId, userId))
        .limit(pagination.limit || 20)
        .offset(offset)
        .orderBy(desc(documents.createdAt))

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(eq(documents.userId, userId))
      const count = result[0]?.count ?? 0

      return {
        data: docList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 20,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 20)),
        },
      }
    } catch (error) {
      return { error: 'Failed to fetch documents' }
    }
  }

  async findByFolder(folderId: string, userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Document>> {
    try {
      const { pagination = { page: 1, limit: 20 } } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 20)

      const docList = await this.db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.folderId, folderId)))
        .limit(pagination.limit || 20)
        .offset(offset)
        .orderBy(desc(documents.createdAt))

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.folderId, folderId)))
      const count = result[0]?.count ?? 0

      return {
        data: docList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 20,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 20)),
        },
      }
    } catch (error) {
      return { error: 'Failed to fetch documents by folder' }
    }
  }

  async findUnfiled(userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<Document>> {
    try {
      const { pagination = { page: 1, limit: 20 } } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 20)

      const docList = await this.db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), sql`${documents.folderId} IS NULL`))
        .limit(pagination.limit || 20)
        .offset(offset)
        .orderBy(desc(documents.createdAt))

      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(and(eq(documents.userId, userId), sql`${documents.folderId} IS NULL`))
      const count = result[0]?.count ?? 0

      return {
        data: docList,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 20,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 20)),
        },
      }
    } catch (error) {
      return { error: 'Failed to fetch unfiled documents' }
    }
  }

  async updateStatus(
    id: string,
    userId: string,
    status: Document['status'],
    errorMessage?: string
  ): Promise<ServiceResponse<Document>> {
    try {
      const [updated] = await this.db
        .update(documents)
        .set({ status, errorMessage: errorMessage || null, updatedAt: new Date() })
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning()

      if (!updated) {
        return { error: 'Document not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update document status' }
    }
  }

  async updateChunkCount(id: string, userId: string, chunkCount: number): Promise<ServiceResponse<Document>> {
    try {
      const [updated] = await this.db
        .update(documents)
        .set({ chunkCount, updatedAt: new Date() })
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning()

      if (!updated) {
        return { error: 'Document not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update chunk count' }
    }
  }

  async updateContentHash(id: string, userId: string, contentHash: string): Promise<ServiceResponse<Document>> {
    try {
      const [updated] = await this.db
        .update(documents)
        .set({ contentHash, updatedAt: new Date() })
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning()

      if (!updated) {
        return { error: 'Document not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update content hash' }
    }
  }

  async updateMetadata(id: string, userId: string, metadata: Record<string, any>): Promise<ServiceResponse<Document>> {
    try {
      const [updated] = await this.db
        .update(documents)
        .set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning()

      if (!updated) {
        return { error: 'Document not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update metadata' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<Document>> {
    try {
      const [deleted] = await this.db
        .delete(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning()

      if (!deleted) {
        return { error: 'Document not found', code: 'NOT_FOUND' }
      }

      return { data: deleted }
    } catch (error) {
      return { error: 'Failed to delete document' }
    }
  }

  async findByContentHash(hash: string, userId: string, excludeId?: string): Promise<ServiceResponse<Document>> {
    try {
      const conditions = [
        eq(documents.contentHash, hash),
        eq(documents.userId, userId),
      ]
      if (excludeId) {
        conditions.push(sql`${documents.id} != ${excludeId}`)
      }

      const [doc] = await this.db
        .select()
        .from(documents)
        .where(and(...conditions))
        .limit(1)

      return { data: doc }
    } catch (error) {
      return { error: 'Failed to check content hash' }
    }
  }
}

export class ChunkService {
  private db = useDrizzle()

  async createMany(chunks: CreateChunkData[]): Promise<ServiceResponse<number>> {
    try {
      if (chunks.length === 0) return { data: 0 }

      const values = chunks.map(c => ({
        id: crypto.randomUUID(),
        documentId: c.documentId,
        userId: c.userId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        contentHash: c.contentHash || null,
        embedding: c.embedding ? new Float32Array(c.embedding) : null,
        tokenCount: c.tokenCount,
        metadata: c.metadata ? JSON.stringify(c.metadata) : null,
        createdAt: new Date(),
      }))

      await this.db.insert(documentChunks).values(values)
      return { data: chunks.length }
    } catch (error) {
      return { error: 'Failed to create chunks' }
    }
  }

  async deleteByDocument(documentId: string): Promise<ServiceResponse<number>> {
    try {
      const result = await this.db
        .delete(documentChunks)
        .where(eq(documentChunks.documentId, documentId))
      return { data: 0 }
    } catch (error) {
      return { error: 'Failed to delete chunks' }
    }
  }

  async findByDocument(documentId: string): Promise<ServiceResponse<DocumentChunk[]>> {
    try {
      const chunks = await this.db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, documentId))
        .orderBy(documentChunks.chunkIndex)

      return { data: chunks }
    } catch (error) {
      return { error: 'Failed to fetch chunks' }
    }
  }

  async deleteByIds(ids: string[]): Promise<ServiceResponse<number>> {
    try {
      if (ids.length === 0) return { data: 0 }
      await this.db
        .delete(documentChunks)
        .where(inArray(documentChunks.id, ids))
      return { data: ids.length }
    } catch (error) {
      return { error: 'Failed to delete chunks' }
    }
  }

  async search(
    userId: string,
    queryEmbedding: number[],
    limit: number = 5,
    filters?: { documentId?: string; metadataKey?: string; metadataValue?: string }
  ): Promise<ServiceResponse<Array<{ content: string; documentId: string; similarity: number; metadata: Record<string, any> | null }>>> {
    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`

      const whereClauses: string[] = ['dc.user_id = ?']
      const args: any[] = [userId, embeddingStr]

      if (filters?.documentId) {
        whereClauses.push('dc.document_id = ?')
        args.push(filters.documentId)
      }

      if (filters?.metadataKey && filters?.metadataValue) {
        whereClauses.push(`json_extract(dc.metadata, '$.${filters.metadataKey}') LIKE ?`)
        args.push(`%${filters.metadataValue}%`)
      }

      args.push(limit)

      const results = await tursoClient.execute({
        sql: `
          SELECT dc.content, dc.document_id, dc.metadata,
                 vector_distance_cos(dc.embedding, vector32(?)) as similarity
          FROM document_chunks dc
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY similarity ASC
          LIMIT ?
        `,
        args,
      })

      const rows = results.rows.map(r => {
        let metadata: Record<string, any> | null = null
        try {
          metadata = r.metadata ? JSON.parse(r.metadata as string) : null
        } catch {
          // invalid JSON
        }
        return {
          content: r.content as string,
          documentId: r.document_id as string,
          similarity: r.similarity as number,
          metadata,
        }
      })

      return { data: rows }
    } catch (error) {
      return { error: 'Failed to search chunks' }
    }
  }
}

export const documentService = new DocumentService()
export const chunkService = new ChunkService()
