<i18n src="./MediaGalleryForUser.json"></i18n>
<script lang="ts" setup>
import type { Asset } from '#layers/BaseDB/db/schema'

const { assets, fetUserAssets } = useAssetManagement()
await fetUserAssets()

const $emit = defineEmits({
  select: (asset: Asset[]) => true,
  deselect: (asset: Asset[]) => true
})

const selected = defineModel<Asset[]>('selected', {
  type: Array,
  default: () => [],
})

const selectedTab = ref('local')
const showUploader = ref(false)
const toast = useToast()

function getAssetType(mimeType: string): 'image' | 'video' | 'pdf' | 'audio' | 'other' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'other'
}

function getAssetIcon(type: ReturnType<typeof getAssetType>): string {
  switch (type) {
    case 'video': return 'lucide:film'
    case 'pdf': return 'lucide:file-text'
    case 'audio': return 'lucide:music'
    case 'other': return 'lucide:file'
    default: return 'lucide:image'
  }
}

const HandleSelect = (asset: Asset) => {
  if (selected.value.includes(asset)) {
    selected.value = selected.value.filter(item => item.id !== asset.id)
    $emit('deselect', selected.value)
  } else {
    selected.value.push(asset)
    $emit('select', selected.value)
  }
}

const HandleExternalSelect = (assetsToAdd: Asset[]) => {
  const newAssets = assetsToAdd.filter(
    (newAsset) => !selected.value.some((existingAsset) => existingAsset.id === newAsset.id),
  )
  selected.value.push(...newAssets)
  $emit('select', selected.value)
  toast.add({
    title: 'Assets Added',
    description: `${newAssets.length} asset(s) imported successfully`,
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })
}

const { t } = useI18n({ useScope: 'local' })

const items = [{
  label: t('local'),
  icon: 'lucide:folder',
  value: 'local',
  slot: 'local' as const
}, {
  label: t('pexels'),
  icon: 'lucide:image',
  value: 'pexels',
  slot: 'pexels' as const
}, {
  label: t('canvas'),
  icon: 'lucide:brush',
  value: 'canvas',
  slot: 'canvas' as const
}, {
  label: t('googleDrive'),
  icon: 'lucide:folder-open',
  value: 'google-drive',
  slot: 'google-drive' as const
}]
</script>

<template>
  <section class="mt-5">
    <UTabs v-model="selectedTab" :items="items" class="w-full">
      <template #default="{ item }">
        <div class="flex items-center gap-2 relative">
          <span class="truncate">{{ item.label }}</span>
        </div>
      </template>

      <template #local>
        <div class="mt-5">
          <UButton size="sm" class="glass-button hover-scale-105 shrink-0" @click="showUploader = !showUploader">
            {{ showUploader ? '' : t('upload') }}
            <Icon :name="showUploader ? 'lucide:x' : 'lucide:upload'" class="w-4 h-4" />
          </UButton>
          <section v-if="showUploader" class="mt-5">
            <MediaUploader :business-id="''" :with-padding="false" />
          </section>

          <div class="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-3">
            <BaseShinyCard v-for="asset in assets" :key="asset.id" :show-bg="false" @click="HandleSelect(asset)">
              <UCard :ui="{ header: 'p-0 sm:p-2', footer: 'p-0 sm:p-2', body: 'p-0 sm:p-0 h-full', root: 'p-1' }"
                class="bg-muted/50 dark:bg-card hover:bg-background dark:hover:bg-background transition-all delay-75 group/number h-full relative">
                <section class="text-muted-foreground">
                  <div
                    class="absolute inset-0 bg-primary-950/95 rounded-lg transition-opacity duration-500 z-50 grid place-content-center font-black"
                    v-if="selected.find(item => item.id === asset.id)">
                    {{ t('selected') }}
                  </div>
                  <div class="relative w-full h-full">
                    <video v-if="getAssetType(asset.mimeType) === 'video'"
                      :src="asset.url" :alt="asset.originalName"
                      class="w-full h-full object-cover rounded-lg shadow-md aspect-square" />
                    <img v-else-if="getAssetType(asset.mimeType) === 'image'"
                      :src="asset.url" :alt="asset.originalName"
                      class="w-full h-full object-cover rounded-lg shadow-md aspect-square" />
                    <div v-else
                      class="w-full h-full flex items-center justify-center bg-muted rounded-lg shadow-md aspect-square">
                      <Icon :name="getAssetIcon(getAssetType(asset.mimeType))" class="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div
                      class="absolute top-1 start-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-background/80 backdrop-blur-sm text-foreground border border-border">
                      {{ t(getAssetType(asset.mimeType)) }}
                    </div>
                  </div>
                </section>
              </UCard>
            </BaseShinyCard>
          </div>
        </div>
      </template>

      <template #pexels>
        <ImageGalleryFromPexel @select-images="HandleExternalSelect" />
      </template>

      <template #canvas>
        <CanvaGallery @select-images="HandleExternalSelect" />
      </template>

      <template #google-drive>
        <GoogleDriveGallery @select-images="HandleExternalSelect" />
      </template>
    </UTabs>
  </section>
</template>
<style scoped></style>
