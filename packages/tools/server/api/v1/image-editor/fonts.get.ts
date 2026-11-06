import { FONT_MANIFEST, FONT_PAIRS } from '../../../../shared/image-editor/fonts-manifest'
import { FONT_ALIASES } from '../../../../shared/image-editor/field-aliases'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  await checkUserIsLogin(event)
  log.set({ fonts: FONT_MANIFEST.length })
  return {
    fonts: FONT_MANIFEST,
    pairs: FONT_PAIRS,
    aliases: FONT_ALIASES,
  }
})
