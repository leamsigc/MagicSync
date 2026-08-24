<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useOgMedia } from '../composables/useOgMedia'

defineProps<{
  modelValue: string
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const {
  loggedIn,
  pexelsQuery,
  pexelsPhotos,
  pexelsLoading,
  pexelsSearched,
  myAssets,
  assetsLoading,
  searchPexels,
  loadMyAssets
} = useOgMedia()

const source = ref<'upload' | 'pexels' | 'assets'>('upload')

const sourceTabs = [
  { label: t('upload'), value: 'upload', icon: 'i-lucide-upload' },
  { label: t('pexels'), value: 'pexels', icon: 'i-lucide-camera' },
  { label: t('my_assets'), value: 'assets', icon: 'i-lucide-folder-open' }
] as const

const onFileSelected = (files: File | File[] | null | undefined) => {
  const file = Array.isArray(files) ? files[0] : files
  if (!file) return
  emit('update:modelValue', URL.createObjectURL(file))
}

const pickPexels = (photo: { src: { large: string } }) => {
  emit('update:modelValue', photo.src.large)
}

const pickAsset = (asset: { url: string }) => {
  emit('update:modelValue', asset.url)
}

const openAssets = () => {
  source.value = 'assets'
  if (myAssets.value.length === 0) void loadMyAssets()
}

const requireLogin = () => {
  if (!loggedIn.value) {
    openAssets()
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <p v-if="label" class="text-sm font-medium">{{ label }}</p>
      <UButton
        v-if="modelValue"
        icon="i-lucide-x"
        variant="ghost"
        color="error"
        size="xs"
        :label="t('remove_image')"
        @click="emit('update:modelValue', '')"
      />
    </div>

    <div v-if="modelValue" class="relative rounded-lg overflow-hidden ring-1 ring-neutral-700">
      <img :src="modelValue" alt="" class="w-full h-28 object-cover">
    </div>

    <UTabs
      v-model="source"
      :items="[...sourceTabs]"
      color="neutral"
      size="sm"
      @update:model-value="(v) => { if (v === 'assets') openAssets() }"
    />

    <!-- Upload -->
    <div v-if="source === 'upload'">
      <UFileUpload
        accept="image/*"
        color="neutral"
        variant="area"
        size="sm"
        :label="t('drop_image_here')"
        class="w-full min-h-24"
        @update:model-value="onFileSelected"
      />
      <UFormField :label="t('or_paste_url')" size="xs" class="mt-2">
        <UInput
          :model-value="modelValue.startsWith('blob:') ? '' : modelValue"
          placeholder="https://…"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => emit('update:modelValue', v)"
        />
      </UFormField>
    </div>

    <!-- Pexels (login required) -->
    <div v-else-if="source === 'pexels'" class="space-y-2">
      <div v-if="!loggedIn" class="rounded-lg border border-dashed border-accented p-4 text-center space-y-2">
        <Icon name="i-lucide-lock" class="mx-auto opacity-60" />
        <p class="text-xs text-muted">{{ t('login_to_use_pexels') }}</p>
        <UButton :label="t('login')" size="xs" to="/login" @click="requireLogin" />
      </div>
      <template v-else>
        <div class="flex gap-2">
          <UInput
            v-model="pexelsQuery"
            :placeholder="t('search_pexels_placeholder')"
            size="sm"
            class="flex-1"
            @keydown.enter="searchPexels"
          />
          <UButton icon="i-lucide-search" size="sm" :loading="pexelsLoading" @click="searchPexels" />
        </div>
        <div v-if="pexelsPhotos.length" class="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
          <button
            v-for="photo in pexelsPhotos"
            :key="photo.id"
            type="button"
            class="rounded-md overflow-hidden ring-1 ring-neutral-700 hover:ring-primary transition-shadow"
            @click="pickPexels(photo)"
          >
            <img :src="photo.src.medium" :alt="photo.alt" class="w-full h-20 object-cover" loading="lazy">
          </button>
        </div>
        <p v-else-if="pexelsSearched" class="text-xs text-muted text-center py-4">{{ t('no_results') }}</p>
        <p v-else class="text-xs text-muted text-center py-4">{{ t('search_pexels_hint') }}</p>
      </template>
    </div>

    <!-- My assets (login required) -->
    <div v-else class="space-y-2">
      <div v-if="!loggedIn" class="rounded-lg border border-dashed border-accented p-4 text-center space-y-2">
        <Icon name="i-lucide-lock" class="mx-auto opacity-60" />
        <p class="text-xs text-muted">{{ t('login_to_use_assets') }}</p>
        <UButton :label="t('login')" size="xs" to="/login" />
      </div>
      <template v-else>
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-refresh-cw"
          :label="t('refresh')"
          :loading="assetsLoading"
          @click="loadMyAssets"
        />
        <div v-if="myAssets.length" class="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
          <button
            v-for="asset in myAssets"
            :key="asset.id"
            type="button"
            class="rounded-md overflow-hidden ring-1 ring-neutral-700 hover:ring-primary transition-shadow"
            :title="asset.originalName"
            @click="pickAsset(asset)"
          >
            <img :src="asset.url" :alt="asset.originalName" class="w-full h-20 object-cover" loading="lazy">
          </button>
        </div>
        <p v-else-if="!assetsLoading" class="text-xs text-muted text-center py-4">{{ t('no_images_yet') }}</p>
      </template>
    </div>
  </div>
</template>
