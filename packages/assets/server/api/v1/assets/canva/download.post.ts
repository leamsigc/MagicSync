

interface CanvaAssetItem {
  id: string
  name: string
  thumbnailUrl: string
  mimeType: string
  downloadUrl: string
  type: string
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const { assets: canvaAssets } = await readBody<{ assets: CanvaAssetItem[] }>(event)
    log.set({ assetsCount: canvaAssets?.length || 0 })

    if (!canvaAssets || canvaAssets.length === 0) {
      log.error('No assets provided for download', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No assets provided for download.',
      })
    }

    const canvaToken = await getCanvaToken(user.id)
    if (!canvaToken) {
      log.error('No Canva token found for user', { userId: user.id })
      throw createError({
        statusCode: 401,
        statusMessage: 'Canva not connected. Please connect your Canva account first.',
      })
    }

    const uploadedAssets = []

    for (const asset of canvaAssets) {
      try {
        const downloadResponse = await $fetch<{ download_url: string }>(`https://api.canva.com/rest/v1/assets/${asset.id}/download`, {
          headers: {
            Authorization: `Bearer ${canvaToken}`,
          },
          method: 'GET',
        })

        const fileResponse = await $fetch(downloadResponse.download_url, {
          responseType: 'arrayBuffer',
        })

        const buffer = Buffer.from(new Uint8Array(fileResponse as ArrayBuffer))
        const mimeType = asset.mimeType || 'image/png'

        const result = await createAssetFromBuffer(
          buffer,
          asset.name || `canva-asset-${asset.id}`,
          mimeType,
          user.id,
          undefined,
          {
            originalSource: 'Canva',
            canvaAssetId: asset.id,
            canvaAssetType: asset.type,
            downloadedAt: new Date().toISOString(),
          }
        )

        if (result.success && result.data) {
          uploadedAssets.push(result.data)
        }
      } catch (fileError) {
        log.error('Error downloading Canva asset', { assetId: asset.id, name: asset.name, error: fileError })
      }
    }

    if (uploadedAssets.length === 0) {
      log.error('No Canva assets were successfully downloaded as assets', {})
      throw createError({
        statusCode: 400,
        statusMessage: 'No Canva assets were successfully downloaded as assets.',
      })
    }

    log.info('Canva assets downloaded successfully', { count: uploadedAssets.length })
    return {
      success: true,
      data: uploadedAssets,
      message: `Successfully created ${uploadedAssets.length} asset(s) from Canva.`,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    log.error('Canva download error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error during Canva asset processing.',
    })
  }
})
