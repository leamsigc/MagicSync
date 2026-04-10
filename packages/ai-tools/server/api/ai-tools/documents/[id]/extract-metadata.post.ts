import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService } from '#layers/BaseDB/server/services/document.service'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  // Fetch document
  const docResult = await documentService.findById(id, user.id)
  if (docResult.error || !docResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  const doc = docResult.data

  // Read file from disk
  const filePath = join(process.cwd(), 'upload', doc.storagePath)
  const fileBuffer = await readFile(filePath)

  // Get LLM config and create JWT for Python backend auth
  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmConfigResult = await userLlmConfigService.getDefaultConfig(user.id)
  const llmConfig = llmConfigResult.data ?? null
  const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig)

  const metadata = await $fetch<{
    title: string
    author: string
    language: string
    topics: string[]
    summary: string
    document_type: string
  }>(`${backendUrl}/api/v1/rag/extract-metadata`, {
    method: 'POST',
    body: {
      file_content: fileBuffer.toString('base64'),
      mime_type: doc.mimeType,
    },
    headers: {
      'Authorization': `Bearer ${llmJwt}`,
    },
  })

  // Merge with existing metadata (preserve uploadedAt etc.)
  let existingMeta: Record<string, any> = {}
  try {
    existingMeta = doc.metadata ? JSON.parse(doc.metadata) : {}
  } catch {
    // invalid JSON
  }

  const mergedMetadata = {
    ...existingMeta,
    title: metadata.title,
    author: metadata.author,
    language: metadata.language,
    topics: metadata.topics,
    summary: metadata.summary,
    document_type: metadata.document_type,
    extractedAt: new Date().toISOString(),
  }

  // Save to database
  await documentService.updateMetadata(id, user.id, mergedMetadata)

  return mergedMetadata
})
