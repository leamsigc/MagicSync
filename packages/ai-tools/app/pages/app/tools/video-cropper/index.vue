<i18n src="./index.json"></i18n>
<script lang="ts" setup>
import CropStage from './components/CropStage.vue'
import KeyframesTimeline from './components/KeyframesTimeline.vue'
import CamerasManager from './components/CamerasManager.vue'
import LivePreview from './components/LivePreview.vue'
import AspectRatioConfig from './components/AspectRatioConfig.vue'
import SubtitleEditor from './components/SubtitleEditor.vue'
import AudioTracks from './components/AudioTracks.vue'
import ExportPanel from './components/ExportPanel.vue'
import SelectAssetModal from './components/SelectAssetModal.vue'
import SaveAsAssetModal from './components/SaveAsAssetModal.vue'
import SchedulePostModal from './components/SchedulePostModal.vue'
import UploadDropZone from './components/UploadDropZone.vue'
import { useExport } from './composables/useExport'
import { useVideoCropper } from './composables/useVideoCropper'

const { t } = useI18n()
const toast = useToast()

const {
  videoMetadata, videoFile, hasVideo, layers, settings, fitMode,
  finalVideoAspectRatio, subtitleText, subtitleStyle,
  restartSession, loadVideoUrl, handleGlobalKeydown,
} = useVideoCropper()
const { runExport, cancelExport, isExporting } = useExport()

const exportedBlob = ref<Blob | null>(null)
const showSaveAssetModal = ref(false)
const showScheduleModal = ref(false)
const showSelectAssetModal = ref(false)

const { uploadFiles } = useAssetManagement()

async function handleExport() {
  if (!videoMetadata.value) return
  exportedBlob.value = null
  const blob = await runExport(
    videoFile.value,
    videoMetadata.value,
    layers.value,
    settings.value,
    fitMode.value,
    finalVideoAspectRatio.value,
    subtitleText.value,
    subtitleStyle.value,
    () => {},
  )
  if (blob) {
    exportedBlob.value = blob
    showSaveAssetModal.value = true
    toast.add({ title: t('notifications.export_complete'), description: t('notifications.export_complete_desc'), color: 'success' })
  }
}

async function handleSaveAsAsset(name: string) {
  if (!exportedBlob.value) return
  try {
    const file = new File([exportedBlob.value], name.endsWith('.mp4') ? name : `${name}.mp4`, { type: 'video/mp4' })
    await uploadFiles([file])
    toast.add({ title: t('notifications.saved_as_asset'), color: 'success' })
    showSaveAssetModal.value = false
  } catch (err: any) {
    toast.add({ title: t('notifications.error'), description: err.message, color: 'error' })
  }
}

function handleDownload() {
  if (!exportedBlob.value) return
  const url = URL.createObjectURL(exportedBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `magic_sync_video_${Date.now()}.mp4`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function handlePublishPost(data: { platforms: string[]; caption: string; scheduleAt: string | null }) {
  if (!exportedBlob.value) return
  try {
    showScheduleModal.value = false
    toast.add({ title: t('notifications.post_created'), color: 'success' })
  } catch (err: any) {
    toast.add({ title: t('notifications.error'), description: err.message, color: 'error' })
  }
}

function handleAssetSelect(url: string, name: string) {
  loadVideoUrl(name, url)
  showSelectAssetModal.value = false
  toast.add({ title: t('notifications.asset_imported'), color: 'success' })
}

function handleReset() {
  toast.add({
    title: 'Reset workspace?',
    description: "Clean workspace?",
    actions: [{
      icon: 'i-lucide-trash',
      label: 'Clean',
      color: 'error',
      variant: 'outline',
      onClick: (e) => {
        restartSession()
        exportedBlob.value = null
      }
    }]
  })
}

useEventListener(window, 'keydown', handleGlobalKeydown)
</script>

<template>
  <div class="min-h-screen font-sans bg-default text-highlighted antialiased">
    <main class="flex-1 flex flex-col gap-6 p-6 max-w-400 w-full mx-auto">
      <UploadDropZone v-if="!hasVideo" />

      <template v-else>
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-7 flex flex-col space-y-6">
            <CropStage />
            <KeyframesTimeline />
            <CamerasManager />
          </div>

          <div class="col-span-12 lg:col-span-5 flex flex-col space-y-6">
            <LivePreview />
            <AspectRatioConfig />
            <SubtitleEditor />
            <AudioTracks />

            <ExportPanel :on-export="handleExport" />

            <UCard :ui="{ body: 'p-4', root: 'w-full' }">
              <template #header>
                <h4 class="font-semibold text-xs text-muted uppercase tracking-wider">{{ t('actions.schedule_post') }}</h4>
              </template>
              <div class="grid grid-cols-2 gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-image"
                  @click="()=>{showSelectAssetModal = true}"
                >
                  {{ t('actions.select_from_assets') }}
                </UButton>
                <UButton
                  v-if="exportedBlob"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-calendar"
                  @click="()=>{showScheduleModal = true}"
                >
                  {{ t('actions.schedule_post') }}
                </UButton>
              </div>
            </UCard>
          </div>
        </div>

        <div class="flex justify-center pt-6 border-t border-default mt-6">
          <UButton color="error" variant="outline" icon="i-lucide-rotate-ccw" @click="handleReset">
            {{ t('actions.reset') }}
          </UButton>
        </div>
      </template>
    </main>

    <SelectAssetModal v-model:open="showSelectAssetModal" @select="handleAssetSelect" />
    <SaveAsAssetModal v-model:open="showSaveAssetModal" @save="handleSaveAsAsset" @download="handleDownload" />
    <SchedulePostModal v-model:open="showScheduleModal" @publish="handlePublishPost" />
  </div>
</template>
