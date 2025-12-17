const baseUrl = process.env.NUXT_BASE_URL
export const getPublicUrlForAsset = (assetUrl: string) => {

  return `${baseUrl}${assetUrl.replace('/api/v1/assets/serve/', '/assets/public/')}`
}

export const fetchedImageBase64 = async (url: string) => {
  // Request the image then save to base64 in the server
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return `data:image/jpeg;base64,${base64}`;
}
