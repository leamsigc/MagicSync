<i18n src="./index.json"></i18n>

<script lang="ts" setup>
import type { AdminTableSummary } from '#layers/BaseDB/server/services/admin-data.service'

definePageMeta({
  layout: 'dashboard-layout',
})

const { t } = useI18n()

const tables = ref<AdminTableSummary[]>([])
const loading = ref(true)
const loadError = ref(false)
const searchQuery = ref('')

interface AdminTableGroup {
  group: string
  items: AdminTableSummary[]
}

function matchesQuery(item: AdminTableSummary, query: string): boolean {
  if (!query) return true
  return (
    item.label.toLowerCase().includes(query) ||
    item.key.toLowerCase().includes(query) ||
    item.group.toLowerCase().includes(query)
  )
}

const groups = computed<AdminTableGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const grouped = new Map<string, AdminTableSummary[]>()
  for (const item of tables.value) {
    if (!matchesQuery(item, query)) continue
    const items = grouped.get(item.group) ?? []
    items.push(item)
    grouped.set(item.group, items)
  }
  return [...grouped.entries()].map(([group, items]) => ({ group, items }))
})

async function fetchCatalog() {
  loading.value = true
  loadError.value = false
  try {
    const data = await $fetch<{ tables: AdminTableSummary[] }>('/api/v1/admin/data')
    tables.value = data.tables
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function rowCountLabel(item: AdminTableSummary): string {
  if (item.rowCount === null) return t('rowCountUnknown')
  return t('rowCount', { count: item.rowCount, plural: item.rowCount === 1 ? '' : 's' })
}

onMounted(fetchCatalog)
</script>

<template>
  <UContainer class="space-y-6 py-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('title') }}</h1>
        <p class="text-muted-foreground">{{ t('description') }}</p>
      </div>
      <UButton
        variant="outline"
        icon="lucide:refresh-cw"
        :loading="loading"
        @click="fetchCatalog"
      >
        {{ t('refresh') }}
      </UButton>
    </div>

    <UInput
      v-model="searchQuery"
      icon="lucide:search"
      :placeholder="t('searchPlaceholder')"
      class="max-w-md"
    />

    <UAlert
      v-if="loadError"
      color="error"
      variant="soft"
      icon="lucide:triangle-alert"
      :title="t('loadFailed')"
    >
      <template #actions>
        <UButton variant="outline" size="sm" @click="fetchCatalog">
          {{ t('retry') }}
        </UButton>
      </template>
    </UAlert>

    <div v-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="index in 6" :key="index" class="h-20 w-full rounded-2xl" />
    </div>

    <template v-else>
      <section
        v-for="group in groups"
        :key="group.group"
        v-motion-fade-visible
        :duration="250"
        class="space-y-3"
      >
        <h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {{ group.group }}
        </h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <NuxtLink
            v-for="item in group.items"
            :key="item.key"
            :to="`/app/admin/data/${item.key}`"
            class="block rounded-2xl bg-elevated p-4 transition-shadow hover:shadow-lg"
          >
            <div class="flex items-center gap-3">
              <div class="rounded-lg bg-primary/10 p-2">
                <UIcon name="lucide:table" class="h-5 w-5 text-primary" />
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.label }}</p>
                <p class="text-sm text-muted-foreground">{{ rowCountLabel(item) }}</p>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>

      <UAlert
        v-if="groups.length === 0"
        color="neutral"
        variant="soft"
        icon="lucide:search-x"
        :title="t('empty')"
      />
    </template>
  </UContainer>
</template>
