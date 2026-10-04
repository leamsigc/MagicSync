import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import { documentChunks, documents, type Document } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export type Embedder = (texts: string[]) => Promise<number[][]>

export interface ChunkOptions {
  maxChars?: number
  overlap?: number
}

export interface IngestInput {
  filename: string
  mimeType: string
  text?: string
  base64?: string
}

export interface SearchInput {
  query: string
  limit?: number
}

export interface SearchHit {
  chunkId: string
  documentId: string
  content: string
  distance: number
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 1200
  const overlap = Math.min(options.overlap ?? 150, Math.floor(maxChars / 2))
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    const end = Math.min(start + maxChars, normalized.length)
    chunks.push(normalized.slice(start, end))
    if (end === normalized.length) break
    start = end - overlap
  }
  return chunks
}

export function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function toBlob(vector: number[]): Buffer {
  return Buffer.from(Float32Array.from(vector).buffer)
}

function detectKind(filename: string, mimeType: string): 'pdf' | 'docx' | 'text' | 'unknown' {
  const name = filename.toLowerCase()
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx') || mimeType.includes('wordprocessingml')) return 'docx'
  if (mimeType.startsWith('text/') || name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.markdown')) return 'text'
  return 'unknown'
}

export async function parseDocumentText(input: IngestInput): Promise<ServiceResponse<{ text: string }>> {
  if (input.text) return { success: true, data: { text: input.text } }
  if (!input.base64) return { success: false, error: 'Document content is required', code: 'VALIDATION_ERROR' }

  const buffer = Buffer.from(input.base64, 'base64')
  const kind = detectKind(input.filename, input.mimeType)
  try {
    if (kind === 'pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const extracted = await extractText(pdf, { mergePages: true })
      return { success: true, data: { text: String(extracted.text) } }
    }
    if (kind === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return { success: true, data: { text: result.value } }
    }
    if (kind === 'text') return { success: true, data: { text: buffer.toString('utf8') } }
    return { success: false, error: 'Unsupported document type', code: 'UNSUPPORTED_TYPE' }
  }
  catch {
    return { success: false, error: 'Failed to parse document', code: 'PARSE_FAILED' }
  }
}

export class DocumentIngestService {
  private db = useDrizzle()

  async ingest(userId: string, input: IngestInput, embed: Embedder): Promise<ServiceResponse<{ document: Document, chunks: number, deduped: boolean }>> {
    try {
      const parsed = await parseDocumentText(input)
      if (!parsed.success) return parsed

      const contentHash = hashContent(parsed.data.text)
      const [existing] = await this.db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.contentHash, contentHash)))
        .limit(1)
      if (existing) {
        return { success: true, data: { document: existing, chunks: existing.chunkCount ?? 0, deduped: true } }
      }

      const pieces = chunkText(parsed.data.text)
      const vectors = await embed(pieces)
      const now = new Date()
      const documentId = crypto.randomUUID()
      const [document] = await this.db.insert(documents).values({
        id: documentId,
        userId,
        filename: input.filename,
        originalName: input.filename,
        mimeType: input.mimeType,
        size: parsed.data.text.length,
        storagePath: 'inline',
        contentHash,
        status: 'completed',
        chunkCount: pieces.length,
        createdAt: now,
        updatedAt: now,
      }).returning()

      await this.db.insert(documentChunks).values(pieces.map((content, index) => ({
        id: crypto.randomUUID(),
        documentId,
        userId,
        chunkIndex: index,
        content,
        contentHash: hashContent(content),
        embedding: toBlob(vectors[index] ?? []),
        tokenCount: Math.ceil(content.length / 4),
        createdAt: now,
      })))

      return { success: true, data: { document, chunks: pieces.length, deduped: false } }
    }
    catch {
      return { success: false, error: 'Failed to ingest document' }
    }
  }

  async search(userId: string, input: SearchInput, embed: Embedder): Promise<ServiceResponse<SearchHit[]>> {
    try {
      if (!input.query.trim()) return { success: false, error: 'Query is required', code: 'VALIDATION_ERROR' }
      const [vector] = await embed([input.query])
      if (!vector) return { success: true, data: [] }

      const blob = toBlob(vector)
      const distance = sql<number>`vector_distance_cos(${documentChunks.embedding}, ${blob})`
      const rows = await this.db
        .select({
          chunkId: documentChunks.id,
          documentId: documentChunks.documentId,
          content: documentChunks.content,
          distance,
        })
        .from(documentChunks)
        .where(eq(documentChunks.userId, userId))
        .orderBy(distance)
        .limit(Math.min(input.limit ?? 5, 20))
      return { success: true, data: rows }
    }
    catch {
      return { success: false, error: 'Vector search failed' }
    }
  }
}

export const documentIngestService = new DocumentIngestService()
