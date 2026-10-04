/**
 * Temporary 501 for AI-tools endpoints whose Python implementations were
 * removed. These capabilities move to the Nuxt agent layer or are deleted in
 * T14; the typed `NOT_PORTED` code keeps clients honest in the meantime.
 */
export function notPorted(feature: string): never {
  throw createError({
    statusCode: 501,
    statusMessage: `${feature} is not available in the Nuxt agent runtime`,
    data: { code: 'NOT_PORTED', feature },
  })
}
