<i18n src="./tools.json"></i18n>
<script setup lang="ts">
/**
 * AI tools playground — Text-to-SQL and Web Search.
 *
 * The two generators are unchanged. The web-search results moved to the shared
 * collection shell (Grid / List + a client-side filter over the returned
 * results), so the page keeps one toolbar for its only collection surface.
 */
import { useTextToSQL, useWebSearch } from '#layers/BaseAITools/app/composables/ai-tools/tools/useTools'
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'

interface WebResult {
  title: string
  url: string
  snippet: string
}

type ToolsView = 'grid' | 'list'

const toast = useToast()
const { t } = useI18n()
const activeTab = ref<'sql' | 'search'>('sql')

// Text-to-SQL
const sqlQuery = ref('')
const { sql, explanation, tablesUsed, isLoading: sqlLoading, error: sqlError, generate: generateSQL } = useTextToSQL()

// Web Search
const searchQuery = ref('')
const { results, isLoading: searchLoading, error: searchError, search: runWebSearch } = useWebSearch()

const {
  view,
  setView,
  search,
  setSearch,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<WebResult>({
  key: 'app-ai-tools-web-search',
  modes: ['grid', 'list'] satisfies ToolsView[],
  defaultView: 'grid',
  rows: results,
  searchFields: result => [result.title, result.snippet, result.url],
})

const viewOptions = computed(() => [
  { value: 'grid', label: t('viewGrid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('viewList'), icon: 'i-lucide-list' },
])

function resultRowKey(result: WebResult): string {
  return result.url
}

function handleViewChange(next: ToolsView) {
  setView(next)
}

async function onSQLSubmit() {
  if (!sqlQuery.value.trim()) return
  await generateSQL(sqlQuery.value)
}

function copySQL() {
  if (sql.value) {
    navigator.clipboard.writeText(sql.value)
    toast.add({ title: t('sqlCopied'), color: 'success' })
  }
}

async function onSearchSubmit() {
  if (!searchQuery.value.trim()) return
  await runWebSearch(searchQuery.value)
}

function selectTab(tab: 'sql' | 'search') {
  activeTab.value = tab
}
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #toolbar>
      <BaseCollectionToolbar
        v-if="activeTab === 'search'"
        :search="search"
        :search-placeholder="t('filterResults')"
        :view="view"
        :views="viewOptions"
        :busy="searchLoading"
        @update:search="setSearch"
        @update:view="handleViewChange"
      />
    </template>

    <div class="mb-6 flex gap-2">
      <UButton :variant="activeTab === 'sql' ? 'solid' : 'outline'"
        :color="activeTab === 'sql' ? 'primary' : 'neutral'" icon="i-heroicons-circle-stack" :label="t('tabSql')"
        @click="() => selectTab('sql')" />
      <UButton :variant="activeTab === 'search' ? 'solid' : 'outline'"
        :color="activeTab === 'search' ? 'primary' : 'neutral'" icon="i-heroicons-globe-alt" :label="t('tabSearch')"
        @click="() => selectTab('search')" />
    </div>

    <div v-if="activeTab === 'sql'" class="space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row">
        <UInput v-model="sqlQuery" :placeholder="t('sqlPlaceholder')" class="flex-1" @keydown.enter="onSQLSubmit" />
        <UButton icon="i-heroicons-sparkles" :label="t('sqlGenerate')" color="primary" :loading="sqlLoading"
          @click="onSQLSubmit" />
      </div>

      <UAlert v-if="sqlError" :title="sqlError" color="error" variant="soft" />

      <div v-if="sql" class="space-y-3">
        <div v-if="explanation" class="text-sm text-muted">{{ explanation }}</div>
        <div v-if="tablesUsed.length" class="flex flex-wrap gap-1">
          <UBadge v-for="tableName in tablesUsed" :key="tableName" :label="tableName" variant="soft" size="xs"
            color="primary" />
        </div>
        <div class="relative">
          <pre
            class="overflow-x-auto rounded-xl border border-default bg-elevated p-4 font-mono text-sm">{{ sql }}</pre>
          <UButton icon="i-heroicons-clipboard" size="xs" variant="solid" color="neutral" class="absolute right-2 top-2"
            :aria-label="t('sqlCopied')" @click="copySQL" />
        </div>
      </div>
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row">
        <UInput v-model="searchQuery" :placeholder="t('searchPlaceholder')" class="flex-1"
          @keydown.enter="onSearchSubmit" />
        <UButton icon="i-heroicons-magnifying-glass" :label="t('searchSubmit')" color="primary" :loading="searchLoading"
          @click="onSearchSubmit" />
      </div>

      <UAlert v-if="searchError" :title="searchError" color="error" variant="soft" />

      <BaseCollectionGrid
        v-if="view === 'grid'"
        :items="filtered"
        :row-key="resultRowKey"
        :loading="searchLoading"
        :empty-title="hasActiveFilters ? t('noResultsFiltered') : t('noResults')"
        empty-icon="i-heroicons-magnifying-glass"
      >
        <template #item="{ item: result }">
          <BaseCollectionCard
            :title="result.title"
            :description="result.snippet"
            icon="i-heroicons-globe-alt"
            :to="result.url"
          >
            <template #meta>
              <span class="flex items-center gap-1 truncate">
                <UIcon name="i-heroicons-link" class="size-3.5 shrink-0" />
                <span class="truncate">{{ result.url }}</span>
              </span>
            </template>
          </BaseCollectionCard>
        </template>

        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
            {{ t('clearFilters') }}
          </UButton>
        </template>
      </BaseCollectionGrid>

      <BaseCollectionList
        v-else
        :items="filtered"
        :row-key="resultRowKey"
        :loading="searchLoading"
        :empty-title="hasActiveFilters ? t('noResultsFiltered') : t('noResults')"
        empty-icon="i-heroicons-magnifying-glass"
      >
        <template #item="{ item: result }">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
            <UIcon name="i-heroicons-globe-alt" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <a :href="result.url" target="_blank" rel="noopener"
              class="truncate font-medium text-highlighted hover:underline">{{ result.title }}</a>
            <p class="truncate text-xs text-muted">{{ result.url }}</p>
            <p class="line-clamp-2 text-sm text-muted">{{ result.snippet }}</p>
          </div>
        </template>

        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
            {{ t('clearFilters') }}
          </UButton>
        </template>
      </BaseCollectionList>
    </div>
  </BaseCollectionPage>
</template>
