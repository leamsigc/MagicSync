<script setup lang="ts">
import { useTextToSQL, useWebSearch } from './composables/useTools'

const toast = useToast()
const activeTab = ref<'sql' | 'search'>('sql')

// Text-to-SQL
const sqlQuery = ref('')
const { sql, explanation, tablesUsed, isLoading: sqlLoading, error: sqlError, generate: generateSQL, clear: clearSQL } = useTextToSQL()

async function onSQLSubmit() {
  if (!sqlQuery.value.trim()) return
  await generateSQL(sqlQuery.value)
}

function copySQL() {
  if (sql.value) {
    navigator.clipboard.writeText(sql.value)
    toast.add({ title: 'SQL copied', color: 'success' })
  }
}

// Web Search
const searchQuery = ref('')
const { results, isLoading: searchLoading, error: searchError, search, clear: clearSearch } = useWebSearch()

async function onSearchSubmit() {
  if (!searchQuery.value.trim()) return
  await search(searchQuery.value)
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">AI Tools</h1>
      <p class="text-neutral-500 mt-1">Query your data with natural language or search the web</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <UButton :variant="activeTab === 'sql' ? 'solid' : 'outline'" :color="activeTab === 'sql' ? 'primary' : 'neutral'"
        icon="i-heroicons-circle-stack" label="Text-to-SQL" @click="activeTab = 'sql'" />
      <UButton :variant="activeTab === 'search' ? 'solid' : 'outline'"
        :color="activeTab === 'search' ? 'primary' : 'neutral'" icon="i-heroicons-globe-alt" label="Web Search"
        @click="activeTab = 'search'" />
    </div>

    <!-- Text-to-SQL Tab -->
    <div v-if="activeTab === 'sql'">
      <div class="flex gap-2 mb-4">
        <UInput v-model="sqlQuery" placeholder="e.g. How many posts did I schedule this week?" class="flex-1"
          @keydown.enter="onSQLSubmit" />
        <UButton icon="i-heroicons-sparkles" label="Generate" color="primary" :loading="sqlLoading"
          @click="onSQLSubmit" />
      </div>

      <div v-if="sqlError" class="mb-4">
        <UAlert :title="sqlError" color="error" variant="soft" />
      </div>

      <div v-if="sql" class="space-y-3">
        <div v-if="explanation" class="text-sm text-neutral-500">{{ explanation }}</div>
        <div v-if="tablesUsed.length" class="flex gap-1">
          <UBadge v-for="t in tablesUsed" :key="t" :label="t" variant="soft" size="xs" />
        </div>
        <div class="relative">
          <pre class="bg-neutral-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">{{ sql }}</pre>
          <UButton icon="i-heroicons-clipboard" size="xs" variant="solid" color="neutral" class="absolute top-2 right-2"
            @click="copySQL" />
        </div>
      </div>
    </div>

    <!-- Web Search Tab -->
    <div v-if="activeTab === 'search'">
      <div class="flex gap-2 mb-4">
        <UInput v-model="searchQuery" placeholder="Search the web..." class="flex-1" @keydown.enter="onSearchSubmit" />
        <UButton icon="i-heroicons-magnifying-glass" label="Search" color="primary" :loading="searchLoading"
          @click="onSearchSubmit" />
      </div>

      <div v-if="searchError" class="mb-4">
        <UAlert :title="searchError" color="error" variant="soft" />
      </div>

      <div v-if="results.length" class="space-y-4">
        <div v-for="result in results" :key="result.url"
          class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
          <a :href="result.url" target="_blank" rel="noopener"
            class="text-primary-600 dark:text-primary-400 font-medium hover:underline">
            {{ result.title }}
          </a>
          <p class="text-xs text-neutral-400 mt-1 truncate">{{ result.url }}</p>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{{ result.snippet }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
