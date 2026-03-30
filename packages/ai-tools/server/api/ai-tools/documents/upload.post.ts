import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService } from '#layers/BaseDB/server/services/document.service'
import { readMultipartFormData, createError } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const fileField = formData.find(f => f.name === 'file')
  if (!fileField || !fileField.data) {
    throw createError({ statusCode: 400, statusMessage: 'File field required' })
  }

  const filename = fileField.filename || 'unknown'
  const mimeType = fileField.type || 'application/octet-stream'
  const size = fileField.data.length

  if (size > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'File too large (max 10MB)' })
  }

  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported file type: ${mimeType}` })
  }

  // Save to disk
  const uploadDir = join(process.cwd(), 'upload', 'documents', user.id)
  await mkdir(uploadDir, { recursive: true })

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageName = `${crypto.randomUUID()}_${safeName}`
  const storagePath = join(uploadDir, storageName)
  await writeFile(storagePath, fileField.data)

  // Content hash for deduplication
  const contentHash = createHash('sha256').update(fileField.data).digest('hex')

  // Check for duplicates
  const existing = await documentService.findByContentHash(contentHash, user.id)
  if (existing.data) {
    throw createError({ statusCode: 409, statusMessage: 'Document already uploaded' })
  }

  // Create document record
  const result = await documentService.create(user.id, {
    filename: storageName,
    originalName: filename,
    mimeType,
    size,
    storagePath: `documents/${user.id}/${storageName}`,
    contentHash,
    metadata: { uploadedAt: new Date().toISOString() },
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
