<!--  Translation file -->
<i18n src="#site/app/pages/app/media/index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Asset filters and search controls
 *
 * Thin adapter over the shared `BaseCollectionToolbar`: it owns the media
 * vocabulary (folder scope, file type, masonry/grid/list) and maps the shared
 * `update:filter` event back onto the page's typed v-models. The toolbar itself
 * only reports changes; filtering stays in the page/gallery.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 */

import type { CollectionFilter } from '#layers/BaseUI/app/utils/collection'
import { ALL_SCOPE_TOKEN, folderScopeToken, parseFolderScope, type AssetFolderSummary, type FolderScope } from '#layers/BaseShared/shared/utils/asset-folders'

type FilterType = 'all' | 'image' | 'video' | 'document'
type ViewMode = 'masonry' | 'grid' | 'list' | 'carousel'

interface Props {
  filterType?: FilterType
  searchQuery?: string
  viewMode?: ViewMode
  /** Gallery-only surfaces hide the switcher and drive the view themselves. */
  hideViewMode?: boolean
  folderScope?: FolderScope
  folders?: AssetFolderSummary[]
}

interface Emits {
  'update:filterType': [value: FilterType]
  'update:searchQuery': [value: string]
  'update:viewMode': [value: ViewMode]
  'update:folderScope': [value: FolderScope]
}

const props = withDefaults(defineProps<Props>(), {
  filterType: 'all',
  searchQuery: '',
  viewMode: 'masonry',
  hideViewMode: false,
  folderScope: () => ({ kind: 'unfiled' }),
  folders: () => [],
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

const folderToken = computed(() => folderScopeToken(props.folderScope) ?? ALL_SCOPE_TOKEN)

const folderOptions = computed(() => [
  { value: ALL_SCOPE_TOKEN, label: t('sections.folders.all') },
  { value: 'unfiled', label: t('sections.folders.unfiled') },
  ...props.folders.map(folder => ({
    value: folder.id,
    label: t('sections.folders.with_count', { name: folder.name, count: folder.assetCount }),
  })),
])

const typeOptions = computed(() => [
  { value: 'all', label: t('sections.filter_options.all_files') },
  { value: 'image', label: t('sections.filter_options.images') },
  { value: 'video', label: t('sections.filter_options.videos') },
  { value: 'document', label: t('sections.filter_options.documents') },
])

const filters = computed<CollectionFilter[]>(() => [
  {
    key: 'folder',
    label: t('sections.filters.folder'),
    value: folderToken.value,
    options: folderOptions.value,
    width: 'w-full sm:w-56',
  },
  {
    key: 'type',
    label: t('sections.filters.filter'),
    value: props.filterType,
    options: typeOptions.value,
    width: 'w-full sm:w-40',
  },
])

const viewOptions = computed(() => {
  if (props.hideViewMode) return []
  return [
    { value: 'masonry', label: t('sections.views.masonry'), icon: 'i-lucide-layout-grid' },
    { value: 'grid', label: t('sections.views.grid'), icon: 'i-lucide-grid-3x3' },
    { value: 'list', label: t('sections.views.list'), icon: 'i-lucide-list' },
    { value: 'carousel', label: t('sections.views.carousel'), icon: 'i-lucide-gallery-horizontal' },
  ]
})

function handleSearch(value: string) {
  emit('update:searchQuery', value)
}

function handleFilter(key: string, value: string) {
  if (key === 'folder') {
    emit('update:folderScope', parseFolderScope(value))
    return
  }
  emit('update:filterType', value as FilterType)
}

function handleView(value: string) {
  emit('update:viewMode', value as ViewMode)
}
</script>

<template>
  <BaseCollectionToolbar
    :search="props.searchQuery"
    :search-placeholder="t('sections.filters.search_placeholder')"
    :filters="filters"
    :view="props.viewMode"
    :views="viewOptions"
    @update:search="handleSearch"
    @update:filter="handleFilter"
    @update:view="handleView"
  />
</template>
