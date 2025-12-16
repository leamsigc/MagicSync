const baseUrl = process.env.NUXT_BASE_URL
export const getPublicUrlForAsset = (assetUrl: string) => {

  return `${baseUrl}${assetUrl.replace('/api/v1/assets/serve/', '/assets/public/')}`
}
