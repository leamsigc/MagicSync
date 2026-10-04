import { domToPng } from 'modern-screenshot'
import type { OgPlatform } from './og-model'

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'og-image'

const errorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return undefined
}

export function useOgExport() {
  const toast = useToast()
  const { t } = useI18n()
  const { loggedIn, user, fetchSession } = UseUser()

  const exporting = ref(false)
  const saving = ref(false)
  const lastDataUrl = ref<string>('')

  const nodeToPng = async (node: HTMLElement, platform: OgPlatform): Promise<string> => {
    return await domToPng(node, {
      quality: 1,
      width: platform.width,
      height: platform.height,
      maximumCanvasSize: 10000,
      timeout: 300000
    })
  }

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl)
    return await res.blob()
  }

  const download = async (node: HTMLElement, platform: OgPlatform, title: string) => {
    exporting.value = true
    try {
      lastDataUrl.value = await nodeToPng(node, platform)
      const link = document.createElement('a')
      link.download = `${slug(title)}-${platform.width}x${platform.height}.png`
      link.href = lastDataUrl.value
      link.click()
      toast.add({ title: t('download_started'), color: 'success' })
    } catch (error) {
      toast.add({ title: t('export_failed'), description: errorMessage(error), color: 'error' })
    } finally {
      exporting.value = false
    }
  }

  const saveAsAsset = async (node: HTMLElement, platform: OgPlatform, title: string) => {
    if (!loggedIn.value) {
      await fetchSession()
    }
    if (!loggedIn.value) {
      toast.add({
        title: t('login_required'),
        description: t('login_required_description'),
        color: 'warning',
        actions: [{ label: t('login'), to: '/login', color: 'primary' }]
      })
      return
    }
    saving.value = true
    try {
      const dataUrl = lastDataUrl.value || await nodeToPng(node, platform)
      lastDataUrl.value = dataUrl
      const blob = await dataUrlToBlob(dataUrl)
      const filename = `${slug(title)}-${platform.width}x${platform.height}.png`
      const form = new FormData()
      form.append('files', new File([blob], filename, { type: 'image/png' }))
      await $fetch('/api/v1/assets', { method: 'POST', body: form })
      toast.add({
        title: t('saved_to_assets'),
        description: t('saved_to_assets_description'),
        color: 'success',
        actions: [{ label: t('view_assets'), to: '/app/assets', color: 'primary' }]
      })
    } catch (error) {
      toast.add({ title: t('save_failed'), description: errorMessage(error), color: 'error' })
    } finally {
      saving.value = false
    }
  }

  const copyEmbedHtml = async (platform: OgPlatform, pageUrl?: string) => {
    const base = pageUrl || (import.meta.client ? window.location.origin : '')
    const html = `<meta property="og:image" content="${base}/api/v1/og-image/${slug(lastDataUrl.value || 'og-image')}.png" />\n<meta property="og:image:width" content="${platform.width}" />\n<meta property="og:image:height" content="${platform.height}" />`
    try {
      await navigator.clipboard.writeText(html)
      toast.add({ title: t('copied_meta_tags'), color: 'success' })
    } catch {
      toast.add({ title: t('copy_failed'), color: 'error' })
    }
  }

  return {
    exporting,
    saving,
    lastDataUrl,
    userName: computed(() => user.value?.name || user.value?.email || ''),
    download,
    saveAsAsset,
    copyEmbedHtml
  }
}
