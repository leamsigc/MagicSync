import { eq, and, sql, desc } from 'drizzle-orm'
import { type ServiceResponse } from './types'
import type { SearchServiceType } from './interfaces'
import { documentChunks, documents } from '#layers/BaseDB/db/schema'
import { useDrizzle, tursoClient } from '#layers/BaseDB/server/utils/drizzle'

export interface SearchResult {
  content: string
  documentId: string
  score: number
  rank: number
  metadata: Record<string, any> | null
  source: 'keyword' | 'vector' | 'hybrid' | 'reranked'
}

export interface HybridSearchRequest {
  userId: string
  query: string
  queryEmbedding?: number[]
  limit?: number
  documentId?: string
  folderId?: string
  metadataFilters?: Record<string, string>
}

export interface RerankRequest {
  query: string
  results: SearchResult[]
  topK?: number
}

export class SearchService implements SearchServiceType {
  private db = useDrizzle()

  async keywordSearch(
    userId: string,
    query: string,
    limit: number = 10,
    documentId?: string
  ): Promise<ServiceResponse<SearchResult[]>> {
    try {
      const terms = query.split(/\s+/).filter(Boolean).join(' OR ')

      const whereClause = documentId
        ? 'dc.user_id = ? AND dc.document_id = ?'
        : 'dc.user_id = ?'

      const args: (string | number)[] = [userId]
      if (documentId) {
        args.push(documentId)
      }
      args.push(terms, limit)

      const results = await tursoClient.execute({
        sql: `
          SELECT dc.content,
                 dc.document_id,
                 dc.metadata,
                 bm25(document_chunks_fts) as rank_score
          FROM document_chunks dc
          JOIN document_chunks_fts fts ON fts.rowid = dc.rowid
          WHERE ${whereClause}
            AND fts MATCH ?
          ORDER BY rank_score ASC
          LIMIT ?
        `,
        args,
      })

      const rows = results.rows.map((r, index) => {
        let metadata: Record<string, any> | null = null
        try {
          metadata = r.metadata ? JSON.parse(r.metadata as string) : null
        } catch {
          // invalid JSON
        }
        return {
          content: r.content as string,
          documentId: r.document_id as string,
          score: Math.abs(r.rank_score as number) || 0,
          rank: index + 1,
          metadata,
          source: 'keyword' as const,
        }
      })

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: 'Failed to perform keyword search' }
    }
  }

  async vectorSearch(
    userId: string,
    queryEmbedding: number[],
    limit: number = 10,
    filters?: { documentId?: string; folderId?: string; metadataKey?: string; metadataValue?: string }
  ): Promise<ServiceResponse<SearchResult[]>> {
    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`

      const whereClauses: string[] = ['dc.user_id = ?']
      const args: (string | number)[] = [userId, embeddingStr]

      if (filters?.documentId) {
        whereClauses.push('dc.document_id = ?')
        args.push(filters.documentId)
      }

      if (filters?.folderId) {
        whereClauses.push('d.folder_id = ?')
        args.push(filters.folderId)
      }

      if (filters?.metadataKey && filters?.metadataValue) {
        // SAFE: bind the JSON path as a parameter — never interpolate user input into SQL.
        // Also whitelist the key so only plain JSON-path characters are accepted.
        if (!/^[A-Za-z0-9_.-]+$/.test(filters.metadataKey)) {
          return { success: false, error: 'Invalid metadata key' }
        }
        whereClauses.push(`json_extract(dc.metadata, ?) LIKE ?`)
        args.push(`$.${filters.metadataKey}`, `%${filters.metadataValue}%`)
      }

      args.push(limit)

      const results = await tursoClient.execute({
        sql: `
          SELECT dc.content, dc.document_id, dc.metadata,
                 vector_distance_cos(dc.embedding, vector32(?)) as similarity
          FROM document_chunks dc
          JOIN documents d ON dc.document_id = d.id
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY similarity ASC
          LIMIT ?
        `,
        args,
      })

      const rows = results.rows.map((r, index) => {
        let metadata: Record<string, any> | null = null
        try {
          metadata = r.metadata ? JSON.parse(r.metadata as string) : null
        } catch {
          // invalid JSON
        }
        return {
          content: r.content as string,
          documentId: r.document_id as string,
          score: 1 - (r.similarity as number),
          rank: index + 1,
          metadata,
          source: 'vector' as const,
        }
      })

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: 'Failed to perform vector search' }
    }
  }

  reciprocalRankFusion(
    keywordResults: SearchResult[],
    vectorResults: SearchResult[],
    k: number = 60,
    limit: number = 10
  ): SearchResult[] {
    const scoreMap = new Map<string, { rrfScore: number; item: SearchResult }>()

    for (const item of keywordResults) {
      const rrfScore = 1 / (k + item.rank)
      scoreMap.set(item.content.substring(0, 100), {
        rrfScore,
        item: { ...item, score: rrfScore, source: 'hybrid' },
      })
    }

    for (const item of vectorResults) {
      const key = item.content.substring(0, 100)
      const rrfScore = 1 / (k + item.rank)
      const existing = scoreMap.get(key)
      if (existing) {
        existing.rrfScore += rrfScore
        existing.item.score = existing.rrfScore
        existing.item.source = 'hybrid'
      } else {
        scoreMap.set(key, {
          rrfScore,
          item: { ...item, score: rrfScore, source: 'hybrid' },
        })
      }
    }

    const fused = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit)
      .map((entry, index) => ({
        ...entry.item,
        rank: index + 1,
      }))

    return fused
  }

  async hybridSearch(
    request: HybridSearchRequest
  ): Promise<ServiceResponse<SearchResult[]>> {
    try {
      const { userId, query, queryEmbedding, limit = 10, documentId, folderId, metadataFilters } = request

      const keywordLimit = limit * 2
      const keywordResults = await this.keywordSearch(userId, query, keywordLimit, documentId)

      if (keywordResults.error) {
        return { success: false, error: keywordResults.error }
      }

      let vectorResults: SearchResult[] = []
      if (queryEmbedding && queryEmbedding.length > 0) {
        const vectorFilters = {
          documentId: documentId,
          folderId: folderId,
          metadataKey: metadataFilters ? Object.keys(metadataFilters)[0] : undefined,
          metadataValue: metadataFilters ? Object.values(metadataFilters)[0] : undefined
        }

        const vectorResult = await this.vectorSearch(userId, queryEmbedding, keywordLimit, vectorFilters)
        if (vectorResult.error) {
          return { success: false, error: vectorResult.error }
        }
        vectorResults = vectorResult.data || []
      }

      if (vectorResults.length === 0) {
        const ranked = (keywordResults.data || []).map((item, index) => ({
          ...item,
          rank: index + 1,
        }))
        return { success: true, data: ranked.slice(0, limit) }
      }

      const fused = this.reciprocalRankFusion(
        keywordResults.data || [],
        vectorResults,
        60,
        limit
      )

      return { success: true, data: fused }
    } catch (error) {
      return { success: false, error: 'Failed to perform hybrid search' }
    }
  }

  async rerank(
    request: RerankRequest
  ): Promise<ServiceResponse<SearchResult[]>> {
    try {
      const { query: _query, results, topK = 5 } = request

      if (results.length === 0) {
        return { success: true, data: [] }
      }

      // Local score-boost reranking (no Python backend).
      const reranked = results
        .map((item) => ({
          ...item,
          score: item.score * 1.1,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((item, index) => ({
          ...item,
          rank: index + 1,
          source: 'reranked' as const,
        }))

      return { success: true, data: reranked }
    } catch (error) {
      return { success: false, error: 'Failed to rerank results' }
    }
  }
}

export const searchService = new SearchService()
