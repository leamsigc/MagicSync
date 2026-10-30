<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Auto-Repost configuration page.
 *
 * One rule per post: `GET /api/v1/posts/auto-repost/{id}/config` reads it and
 * `POST .../configure` writes it. The page adopts the shared collection shell
 * (Table / List + search) over the loaded rule and keeps the form that edits
 * it; the save CTA lives in the page header.
 */
import { useAutoRepost, type AutoRepostConfig } from '~/composables/useAutoRepost'
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'
import dayjs from 'dayjs'

type AutoRepostView = 'table' | 'list'
type RuleTone = 'success' | 'neutral'

interface AutoRepostRule {
  id: string
  enabled: boolean
  intervalHours: number
  maxReposts: number
  currentCount: number
  nextRepostAt: string
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { loading, error, configure, getConfig } = useAutoRepost()

const postId = ref((route.query.postId as string) || '')
const enabled = ref(true)
const intervalHours = ref(24)
const maxReposts = ref(3)
const currentConfig = ref<AutoRepostConfig | null>(null)
const loadingRule = ref(false)

// The stored config is the only server truth the page can list: there is one
// auto-repost rule per post, so the collection renders 0 or 1 row.
const rules = computed<AutoRepostRule[]>(() => {
  const config = currentConfig.value
  if (!config || !postId.value) return []
  return [{
    id: postId.value,
    enabled: config.enabled,
    intervalHours: config.intervalHours,
    maxReposts: config.maxReposts,
    currentCount: config.currentCount,
    nextRepostAt: config.nextRepostAt ?? '',
  }]
})

const {
  view,
  setView,
  search,
  setSearch,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<AutoRepostRule>({
  key: 'app-posts-auto-repost',
  modes: ['table', 'list'] satisfies AutoRepostView[],
  defaultView: 'table',
  rows: rules,
  searchFields: rule => [rule.id, rule.enabled ? t('status.enabled') : t('status.disabled')],
})

const viewOptions = computed(() => [
  { value: 'table', label: t('views.table'), icon: 'i-lucide-table' },
  { value: 'list', label: t('views.list'), icon: 'i-lucide-list' },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'postId', label: t('columns.postId') },
  { key: 'state', label: t('columns.state') },
  { key: 'intervalHours', label: t('intervalHours'), hideBelow: 'sm' },
  { key: 'maxReposts', label: t('maxReposts'), hideBelow: 'md' },
  { key: 'currentCount', label: t('currentCount'), hideBelow: 'md' },
  { key: 'nextRepostAt', label: t('nextRepostAt'), hideBelow: 'lg' },
])

const emptyTitle = computed(() =>
  hasActiveFilters.value ? t('emptyFiltered') : t('noConfig')
)

const emptyHint = computed(() =>
  hasActiveFilters.value ? t('emptyFilteredHint') : t('emptyHint')
)

function ruleRowKey(rule: AutoRepostRule): string {
  return rule.id
}

function ruleState(rule: AutoRepostRule): string {
  return rule.enabled ? t('status.enabled') : t('status.disabled')
}

function ruleTone(rule: AutoRepostRule): RuleTone {
  return rule.enabled ? 'success' : 'neutral'
}

function nextRepostLabel(rule: AutoRepostRule): string {
  return rule.nextRepostAt ? dayjs(rule.nextRepostAt).format('MMM D, YYYY h:mm A') : ''
}

function handleViewChange(next: string) {
  setView(next)
}

const handleLoad = async () => {
  if (!postId.value) return
  loadingRule.value = true
  try {
    const cfg = await getConfig(postId.value)
    currentConfig.value = cfg
    if (cfg) {
      enabled.value = cfg.enabled
      intervalHours.value = cfg.intervalHours
      maxReposts.value = cfg.maxReposts
    }
  } finally {
    loadingRule.value = false
  }
}

const handleSave = async () => {
  if (!postId.value) return
  try {
    const cfg = await configure(postId.value, {
      enabled: enabled.value,
      intervalHours: intervalHours.value,
      maxReposts: maxReposts.value,
    })
    currentConfig.value = cfg
    toast.add({ title: t('saved'), color: 'success' })
  } catch {
    toast.add({ title: t('error'), description: error.value || '', color: 'error' })
  }
}

const handleToggleEnabled = () => {
  enabled.value = !enabled.value
}

onMounted(() => {
  if (postId.value) {
    handleLoad()
  }
})

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }],
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')" container="full">
    <template #actions>
      <UButton icon="i-lucide-save" color="primary" :loading="loading" :label="loading ? t('saving') : t('save')"
        @click="handleSave" />
    </template>

    <template #toolbar>
      <BaseCollectionToolbar :search="search" :search-placeholder="t('search')" :view="view" :views="viewOptions"
        :busy="loading" @update:search="setSearch" @update:view="handleViewChange" />
    </template>

    <BaseCollectionList v-if="view === 'list'" :items="filtered" :row-key="ruleRowKey" :loading="loadingRule"
      :empty-title="emptyTitle" :empty-hint="emptyHint" empty-icon="i-lucide-repeat">
      <template #item="{ item }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon name="i-lucide-repeat" class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-mono text-sm text-highlighted">{{ item.id }}</p>
          <p class="truncate text-sm text-muted">
            {{ t('listSummary', { interval: item.intervalHours, max: item.maxReposts, count: item.currentCount }) }}
          </p>
        </div>
        <UBadge class="shrink-0" :color="ruleTone(item)" variant="subtle" size="sm">
          {{ ruleState(item) }}
        </UBadge>
        <span class="hidden w-40 text-right text-xs text-muted sm:block">{{ nextRepostLabel(item) }}</span>
      </template>
      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" @click="resetFilters">
          {{ t('clearFilters') }}
        </UButton>
      </template>
    </BaseCollectionList>

    <BaseDataTable v-else :rows="filtered" :columns="columns" :row-key="ruleRowKey" :loading="loadingRule"
      :empty-title="emptyTitle" :empty-hint="emptyHint" empty-icon="i-lucide-repeat" min-width="40rem">
      <template #cell-postId="{ row }">
        <span class="font-mono text-xs text-highlighted">{{ row.id }}</span>
      </template>
      <template #cell-state="{ row }">
        <UBadge :color="ruleTone(row)" variant="subtle" size="sm">{{ ruleState(row) }}</UBadge>
      </template>
      <template #cell-nextRepostAt="{ row }">
        <span class="whitespace-nowrap text-sm text-muted">{{ nextRepostLabel(row) }}</span>
      </template>
      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" @click="resetFilters">
          {{ t('clearFilters') }}
        </UButton>
      </template>
    </BaseDataTable>

    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-settings-2" class="size-4" />
          <p class="font-semibold">{{ t('formTitle') }}</p>
        </div>
      </template>

      <div class="space-y-4">
        <UFormField :label="t('postId')" name="postId">
          <UInput v-model="postId" :placeholder="t('postIdPlaceholder')" class="w-full" />
        </UFormField>

        <div class="flex gap-2">
          <UButton :loading="loadingRule" variant="outline" icon="i-lucide-download" @click="handleLoad">
            {{ t('load') }}
          </UButton>
        </div>

        <div class="flex items-center justify-between">
          <span>{{ enabled ? t('enabled') : t('disabled') }}</span>
          <USwitch :model-value="enabled" @update:model-value="handleToggleEnabled" />
        </div>

        <UFormField :label="t('intervalHours')" name="intervalHours">
          <UInput v-model.number="intervalHours" type="number" :min="1" :max="168" />
        </UFormField>

        <UFormField :label="t('maxReposts')" name="maxReposts">
          <UInput v-model.number="maxReposts" type="number" :min="1" :max="20" />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error }}</p>
      </div>
    </UCard>
  </BaseCollectionPage>
</template>
