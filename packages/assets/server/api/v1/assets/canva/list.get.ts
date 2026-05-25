
interface CanvaDesign {
  id: string
  name: string
  thumbnail_url: string
  mime_type: string
  download_url: string
  type: string
}

interface CanvaListResponse {
  data: CanvaDesign[]
  pagination?: {
    page: number
    size: number
    total: number
    next_page_token?: string
  }
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const query = getQuery(event)
    const pageToken = (query.pageToken as string) || ''
    const pageSize = parseInt(query.pageSize as string) || 15

    const canvaToken = await getCanvaToken(user.id)
    if (!canvaToken) {
      log.error('No Canva token found for user', { userId: user.id })
      throw createError({
        statusCode: 401,
        statusMessage: 'Canva not connected. Please connect your Canva account first.',
      })
    }

    const params: Record<string, string> = {
      size: pageSize.toString(),
    }
    if (pageToken) {
      params.next_page_token = pageToken
    }

    const canvaResponse = await $fetch<CanvaListResponse>('https://api.canva.com/rest/v1/assets', {
      headers: {
        Authorization: `Bearer ${canvaToken}`,
      },
      query: params,
    })

    log.info('Canva assets listed', { count: canvaResponse.data?.length || 0 })
    return {
      success: true,
      assets: canvaResponse.data.map((design) => ({
        id: design.id,
        name: design.name,
        thumbnailUrl: design.thumbnail_url,
        mimeType: design.mime_type,
        downloadUrl: design.download_url,
        type: design.type,
      })),
      nextPageToken: canvaResponse.pagination?.next_page_token,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    log.error('Canva list error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list Canva assets',
    })
  }
})
