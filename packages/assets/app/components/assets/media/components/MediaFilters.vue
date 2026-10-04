<!--  Translation file -->
<i18n src="#site/app/pages/app/media/index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Asset Filters and Search Controls
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

import { ALL_SCOPE_TOKEN, folderScopeToken, parseFolderScope, type AssetFolderSummary, type FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'

const ALL_TOKEN = ALL_SCOPE_TOKEN

type Props = {
  filterType: 'all' | 'image' | 'video' | 'document'
  searchQuery: string
  viewMode: 'grid' | 'list',
  hideViewMode?: boolean
  folderScope: FolderScope
  folders: AssetFolderSummary[]
}

type Emits = {
  'update:filterType': [value: 'all' | 'image' | 'video' | 'document']
  'update:searchQuery': [value: string]
  'update:viewMode': [value: 'grid' | 'list']
  'update:folderScope': [value: FolderScope]
}

const props = withDefaults(defineProps<Props>(), {
  filterType: 'all',
  searchQuery: '',
  viewMode: 'grid',
  hideViewMode: false,
  folderScope: () => ({ kind: 'unfiled' }),
  folders: () => [],
})
const emit = defineEmits<Emits>()
const { t } = useI18n()

const filterType = computed({
  get: () => props.filterType,
  set: (value) => emit('update:filterType', value)
})

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value)
})

const viewMode = computed({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value)
})

const folderToken = computed({
  get: () => folderScopeToken(props.folderScope) ?? ALL_TOKEN,
  set: (value: string) => emit('update:folderScope', parseFolderScope(value))
})

const setViewMode = (mode: 'grid' | 'list') => emit('update:viewMode', mode)

const filterOptions = [
  { value: 'all', label: t('sections.filter_options.all_files'), icon: 'i-lucide-files' },
  { value: 'image', label: t('sections.filter_options.images'), icon: 'i-lucide-image' },
  { value: 'video', label: t('sections.filter_options.videos'), icon: 'i-lucide-video' },
  { value: 'document', label: t('sections.filter_options.documents'), icon: 'i-lucide-file' }
]

const folderOptions = computed(() => [
  { value: ALL_TOKEN, label: t('sections.folders.all'), icon: 'i-lucide-files' },
  { value: 'unfiled', label: t('sections.folders.unfiled'), icon: 'i-lucide-inbox' },
  ...props.folders.map(folder => ({
    value: folder.id,
    label: t('sections.folders.with_count', { name: folder.name, count: folder.assetCount }),
    icon: 'i-lucide-folder',
  })),
])
</script>

<template>
  <UCard class="p-4" variant="soft">
    <div class="flex flex-wrap items-center gap-4">
      <!-- File Type Filter -->
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium">{{ t('sections.filters.folder') }}</label>
        <USelect v-model="folderToken" :items="folderOptions" class="w-[200px]" />
      </div>

      <!-- File Type Filter -->
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium">{{ t('sections.filters.filter') }}</label>
        <USelect v-model="filterType" :items="filterOptions" class="w-[140px]" />
      </div>

      <!-- View Mode Toggle -->
      <div class="flex items-center gap-2 ml-auto" v-if="!hideViewMode">
        <label class="text-sm font-medium">{{ t('sections.filters.view') }}</label>
        <div class="flex  rounded-lg">
          <UButton variant="ghost" size="sm" :class="{ 'bg-muted': viewMode === 'grid' }" @click="setViewMode('grid')">
            <Icon name="lucide:grid-3x3" class="h-4 w-4" />
          </UButton>
          <UButton variant="ghost" size="sm" :class="{ 'bg-muted': viewMode === 'list' }" @click="setViewMode('list')">
            <Icon name="lucide:list" class="h-4 w-4" />
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
