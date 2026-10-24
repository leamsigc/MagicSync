import { auth } from '#layers/BaseAuth/lib/auth'
import { readFile } from 'fs/promises'
import { relative, resolve, sep } from 'path'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const FILE_STORAGE_MOUNT = process.env.NUXT_FILE_STORAGE_MOUNT


  try {
    // Get user from session
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    // Get the file path from the route parameters
    const path = getRouterParam(event, 'path')
    log.set({ path })

    if (!path) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File path is required'
      })
    }

    // Security: resolve the path and prove it stays inside the user's folder.
    // A string `replace('..','')` filter is bypassable (`....//`, encoded
    // separators); resolve + prefix comparison is not.
    const userFolder = resolve(process.cwd(), FILE_STORAGE_MOUNT || './upload/files', 'userFiles', user.id)
    const fullPath = resolve(userFolder, path)
    if (fullPath !== userFolder && !fullPath.startsWith(`${userFolder}${sep}`)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
    }
    const safePath = relative(userFolder, fullPath)

    try {
      // Read the file
      const fileBuffer = await readFile(fullPath)

      // Determine content type based on file extension
      const ext = safePath.split('.').pop()?.toLowerCase()
      let contentType = 'application/octet-stream'

      if (ext) {
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'pdf': 'application/pdf',
          'txt': 'text/plain',
          'json': 'application/json'
        }
        contentType = mimeTypes[ext] || contentType
      }

      // Private user content: never let a shared cache store it for another
      // user, and never let the browser sniff it into executable HTML.
      setHeader(event, 'Content-Type', contentType)
      setHeader(event, 'Cache-Control', 'private, max-age=31536000, immutable')
      setHeader(event, 'X-Content-Type-Options', 'nosniff')

      return fileBuffer
    } catch (fileError) {
      throw createError({
        statusCode: 404,
        statusMessage: 'File not found'
      })
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    log.error('Failed to serve file', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
