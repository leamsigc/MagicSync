<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const { loadVideoFile, loadVideoUrl, loadCustomVideoFromUrl } = useVideoCropper()

const urlInput = ref('')

function onFileUpload(file: File | null) {
  if (file && file.type.startsWith('video/')) loadVideoFile(file)
}

function loadUrl() {
  const url = urlInput.value.trim()
  if (!url) return
  if (!url.startsWith('http://') && !url.startsWith('https://')) return
  loadCustomVideoFromUrl(url)
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

        <div class="flex gap-1">
          <UInput v-model="urlInput" :placeholder="t('upload.url_placeholder')" block class="flex-1" />
          <UButton color="neutral" variant="outline" @click="loadUrl">
            {{ t('upload.load_url') }}
          </UButton>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-xs font-mono text-dimmed">{{ t('upload.quick_start') }}</span>
          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" @click="loadVideoUrl('Big Buck Bunny', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')">
              {{ t('upload.demo_bunny') }}
            </UButton>
            <UButton color="neutral" variant="outline" @click="loadVideoUrl('Sintel Action', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4')">
              {{ t('upload.demo_sintel') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
