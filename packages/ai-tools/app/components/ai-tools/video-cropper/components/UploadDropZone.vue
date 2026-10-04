<i18n src="#site/app/pages/app/tools/video-cropper/index.json"></i18n>

<script lang="ts" setup>
import { useRemoteVideoDownload } from '../../../../composables/ai-tools/tools/video-cropper/useRemoteVideoDownload'
import { useVideoCropper } from '../../../../composables/ai-tools/tools/video-cropper/useVideoCropper'

const { t } = useI18n()
const toast = useToast()

const { loadVideoFile, loadDemoVideo, loadCustomVideoFromUrl } = useVideoCropper()
const { isDownloading, downloadToFile, isHttpUrl } = useRemoteVideoDownload()

const urlInput = ref('')

function onFileUpload(file: File | null) {
  if (!file || !file.type.startsWith('video/')) return
  loadVideoFile(file)
}

/** A direct media link the browser can play as-is. */
function loadDirectUrl() {
  const url = urlInput.value.trim()
  if (!isHttpUrl(url)) {
    toast.add({ title: t('notifications.error'), description: t('download_errors.URL_REQUIRED'), color: 'error' })
    return
  }
  loadCustomVideoFromUrl(url)
}

/** A video page URL (YouTube, Vimeo, …) resolved and streamed by the server. */
async function downloadFromPage() {
  const url = urlInput.value.trim()
  if (!isHttpUrl(url)) {
    toast.add({ title: t('notifications.error'), description: t('download_errors.URL_REQUIRED'), color: 'error' })
    return
  }
  try {
    const file = await downloadToFile(url)
    loadVideoFile(file)
    toast.add({ title: t('notifications.video_loaded'), color: 'success' })
  }
  catch (error) {
    const code = error instanceof Error ? error.message : 'DOWNLOAD_FAILED'
    toast.add({ title: t('notifications.error'), description: t(`download_errors.${code}`), color: 'error' })
  }
}

function loadDemo(name: string, url: string) {
  loadDemoVideo(name, url)
}
</script>

<template>
  <UCard :ui="{ body: 'p-8 ', root: 'w-full min-h-[80vh] grid place-items-center '  }">
    <div class="flex flex-col items-center gap-8 max-w-lg mx-auto my-auto">
      <UFileUpload
        accept="video/mp4,video/webm,video/mov,video/quicktime"
        class="w-full"
        @update:model-value="(f: any) => onFileUpload(f)"
      >
        <template #default="{ open }">
          <div
            class="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-default rounded-2xl cursor-pointer hover:border-(--ui-primary)/50 transition-colors bg-muted/30"
            @click="()=>{open()}"
          >
            <UIcon name="i-lucide-film" class="w-8 h-8 text-primary" />
            <span class="text-sm font-semibold text-highlighted">{{ t('upload.title') }}</span>
            <span class="text-xs text-dimmed text-center">{{ t('upload.description') }}</span>
            <UButton color="primary" variant="soft" size="sm" @click.stop="()=>{open()}">
              {{ t('upload.browse') }}
            </UButton>
          </div>
        </template>
      </UFileUpload>

      <div class="w-full space-y-3">
        <div class="flex items-center gap-3">
          <div class="flex-1 h-px bg-border"></div>
          <span class="text-[10px] font-mono text-dimmed uppercase">{{ t('upload.or_stream') }}</span>
          <div class="flex-1 h-px bg-border"></div>
        </div>

        <UInput v-model="urlInput" :placeholder="t('upload.url_placeholder')" block />

        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            class="flex-1"
            :disabled="isDownloading"
            @click="loadDirectUrl"
          >
            {{ t('upload.load_url') }}
          </UButton>
          <UButton
            color="primary"
            variant="solid"
            class="flex-1"
            :loading="isDownloading"
            @click="downloadFromPage"
          >
            {{ isDownloading ? t('upload.downloading') : t('upload.download_url') }}
          </UButton>
        </div>

        <p class="text-xs text-dimmed text-center leading-relaxed">{{ t('upload.download_hint') }}</p>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-xs font-mono text-dimmed">{{ t('upload.quick_start') }}</span>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isDownloading"
              @click="loadDemo('Big Buck Bunny', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')"
            >
              {{ t('upload.demo_bunny') }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isDownloading"
              @click="loadDemo('Sintel Action', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4')"
            >
              {{ t('upload.demo_sintel') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
