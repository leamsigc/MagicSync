import { ref } from 'vue'
import { useFabricJs } from './useFabricJs'

interface Mp4Failure {
  statusCode?: number
  status?: number
  statusMessage?: string
  data?: { statusMessage?: string; message?: string }
}

/**
 * MP4 export for the design studio.
 *
 * The server renders the same document with the shared animation evaluators
 * and encodes the frame series with ffmpeg. Requires a signed-in design user
 * (the route stores the result as a user asset).
 */
export function useDesignMp4Export() {
  const { editor } = useFabricJs()
  const { t } = useI18n()
  const toast = useToast()
  const exportingMp4 = ref(false)

  function download(url: string): void {
    if (typeof document === 'undefined') return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'design-clip.mp4'
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  async function exportMp4(options: { durationMs?: number } = {}): Promise<void> {
    const plugin = editor.value?.getPlugin?.('studio') as
      { currentDocument?: () => unknown; getPageDuration?: () => number; getPageAudio?: () => { url: string; volume?: number } | null } | undefined
    if (!plugin?.currentDocument) {
      toast.add({ title: t('studio.timeline.mp4Unavailable'), color: 'warning', icon: 'i-lucide-alert-triangle' })
      return
    }
    exportingMp4.value = true
    try {
      const audio = plugin.getPageAudio?.()
      const response = await $fetch<{ url?: string }>('/api/v1/image-editor/mp4', {
        method: 'POST',
        body: {
          document: plugin.currentDocument(),
          fps: 24,
          durationMs: options.durationMs ?? plugin.getPageDuration?.() ?? 4000,
          maxHeight: 1080,
          ...(audio?.url ? { audio: audio.url, audioVolume: (audio.volume ?? 100) / 100 } : {}),
        },
      })
      if (!response?.url) throw new Error('No MP4 URL returned')
      download(response.url)
      toast.add({ title: t('studio.timeline.mp4Ready'), color: 'success', icon: 'i-lucide-film' })
    } catch (error) {
      const failure = error as Mp4Failure
      const status = failure.statusCode ?? failure.status
      const message = status === 401
        ? t('studio.timeline.mp4Auth')
        : failure.data?.statusMessage ?? failure.statusMessage ?? failure.data?.message ?? t('studio.timeline.mp4Failed')
      toast.add({ title: t('studio.timeline.mp4Failed'), description: message, color: 'error', icon: 'i-lucide-x-circle' })
    }
    exportingMp4.value = false
  }

  return { exportingMp4, exportMp4 }
}
