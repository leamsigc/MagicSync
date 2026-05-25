import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

type ImportFrom = 'folder' | 'zip' | 'url'

interface ImportBody {
  zip_base64?: string
  url?: string
  folder_path?: string
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const config = useRuntimeConfig()

  const body = await readBody<ImportBody>(event)
  const queryParams = getQuery(event)
  const targetImportFrom: ImportFrom = (queryParams.importFrom as ImportFrom) || 'folder'

  log.set({ importFrom: targetImportFrom })

  const response = await $fetch(`${config.public.pythonBackendUrl}/skills/import/${targetImportFrom}`, {
    method: 'POST',
    body,
    headers: {
      cookie: getHeader(event, 'cookie') || '',
    },
  })

  return response
})
