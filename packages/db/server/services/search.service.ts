import { eq, and, sql, desc } from 'drizzle-orm'
import { type ServiceResponse } from './types'
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
  metadataFilters?: Record<string, string>
}

export interface RerankRequest {
  query: string
  results: SearchResult[]
  topK?: number
  pythonBackendUrl?: string
}

export class SearchService {
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

      const args: any[] = [userId]
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

      return { data: rows }
    } catch (error) {
      return { error: 'Failed to perform keyword search' }
    }
  }

  async vectorSearch(
    userId: string,
    queryEmbedding: number[],
    limit: number = 10,
    filters?: { documentId?: string; metadataKey?: string; metadataValue?: string }
  ): Promise<ServiceResponse<SearchResult[]>> {
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

      return { data: rows }
    } catch (error) {
      return { error: 'Failed to perform vector search' }
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
      const { userId, query, queryEmbedding, limit = 10, documentId, metadataFilters } = request

      const keywordLimit = limit * 2
      const keywordResults = await this.keywordSearch(userId, query, keywordLimit, documentId)

      if (keywordResults.error) {
        return { error: keywordResults.error }
      }

      let vectorResults: SearchResult[] = []
      if (queryEmbedding && queryEmbedding.length > 0) {
        const vectorFilters = documentId
          ? { documentId, metadataKey: metadataFilters ? Object.keys(metadataFilters)[0] : undefined, metadataValue: metadataFilters ? Object.values(metadataFilters)[0] : undefined }
          : { metadataKey: metadataFilters ? Object.keys(metadataFilters)[0] : undefined, metadataValue: metadataFilters ? Object.values(metadataFilters)[0] : undefined }

        const vectorResult = await this.vectorSearch(userId, queryEmbedding, keywordLimit, vectorFilters)
        if (vectorResult.error) {
          return { error: vectorResult.error }
        }
        vectorResults = vectorResult.data || []
      }

      if (vectorResults.length === 0) {
        const ranked = (keywordResults.data || []).map((item, index) => ({
          ...item,
          rank: index + 1,
        }))
        return { data: ranked.slice(0, limit) }
      }

      const fused = this.reciprocalRankFusion(
        keywordResults.data || [],
        vectorResults,
        60,
        limit
      )

      return { data: fused }
    } catch (error) {
      return { error: 'Failed to perform hybrid search' }
    }
  }

  async rerank(
    request: RerankRequest
  ): Promise<ServiceResponse<SearchResult[]>> {
    try {
      const { query, results, topK = 5, pythonBackendUrl } = request

      if (results.length === 0) {
        return { data: [] }
      }

      // If Python backend URL is provided, use LLM-based reranking
      if (pythonBackendUrl) {
        try {
          const rerankResult = await $fetch<{
            results: Array<{ content: string; document_id: string; score: number; rank: number; metadata: Record<string, any> }>
          }>(`${pythonBackendUrl}/api/v1/rag/rerank`, {
            method: 'POST',
            body: {
              query,
              documents: results.map(r => ({
                content: r.content,
                document_id: r.documentId,
                score: r.score,
                metadata: r.metadata,
              })),
              top_k: topK,
            },
          })

          return {
            data: rerankResult.results.map((r, index) => ({
              content: r.content,
              documentId: r.document_id,
              score: r.score,
              rank: index + 1,
              metadata: r.metadata,
              source: 'reranked' as const,
            })),
          }
        } catch {
          // Fall through to local reranking
        }
      }

      // Local fallback: score-boost reranking
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

      return { data: reranked }
    } catch (error) {
      return { error: 'Failed to rerank results' }
    }
  }
}

export const searchService = new SearchService()
