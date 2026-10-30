<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Component Description: Grow page — Bluesky follow recommendations
 * (follow-backs + network suggestions). All follows are manual.
 *
 * The recommendation feed renders through the shared collection shell
 * (one toolbar with search + the account picker, a single List view). The
 * account loading and follow calls are unchanged.
 */
import { computed, ref } from 'vue'
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'
import { useGrow, type GrowRecommendation } from '~/composables/useGrow'

const { t } = useI18n()
const {
  accounts,
  recommendations,
  loading,
  error,
  followingDid,
  fetchAccounts,
  fetchRecommendations,
  followAccount,
} = useGrow()

const selectedAccount = ref<string | undefined>(undefined)
const showAbout = ref(false)

const { search, setSearch, filtered, hasActiveFilters, resetFilters } = useCollectionView<GrowRecommendation>({
  key: 'app-grow',
  modes: ['list'],
  defaultView: 'list',
  rows: recommendations,
  searchFields: recommendation => [recommendation.displayName, recommendation.handle, recommendation.description],
})

const accountOptions = computed(() => [
  { label: t('select_account'), value: undefined },
  ...accounts.value.map((a) => ({ label: a.accountName, value: a.id })),
])

function recommendationRowKey(recommendation: GrowRecommendation): string {
  return recommendation.did
}

function handleAccountChange(accountId: string | { label?: string; value?: string } | undefined) {
  // USelectMenu emits the whole option object unless value-key resolves it —
  // normalize so we never fetch with "[object Object]".
  const id = typeof accountId === 'string' ? accountId : accountId?.value
  selectedAccount.value = id
  if (id) {
    fetchRecommendations(id)
  }
}

async function handleFollow(did: string) {
  if (!selectedAccount.value) return
  try {
    await followAccount(selectedAccount.value, did)
  } catch {
    // Error surfaced via error state
  }
}

function handleRetry() {
  if (selectedAccount.value) {
    fetchRecommendations(selectedAccount.value)
  } else {
    handleTabOpen()
  }
}

function handleRefresh() {
  if (selectedAccount.value) {
    fetchRecommendations(selectedAccount.value)
  }
}

function handleOpenAbout() {
  showAbout.value = true
}

async function handleTabOpen() {
  await fetchAccounts()
  const first = accounts.value[0]
  if (first && !selectedAccount.value) {
    handleAccountChange(first.id)
  }
}

function reasonBadge(reason: string) {
  return reason === 'follow-back' ? t('follow_back_badge') : t('suggested_badge')
}

function reasonColor(reason: string): 'primary' | 'neutral' {
  return reason === 'follow-back' ? 'primary' : 'neutral'
}

function followLabel(did: string): string {
  return followingDid.value === did ? t('following') : t('follow')
}

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }]
})

onMounted(() => {
  handleTabOpen()
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #actions>
      <UButton variant="ghost" icon="i-lucide-circle-help" @click="handleOpenAbout">
        {{ t('learn_more') }}
      </UButton>
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('search_placeholder')"
        :busy="loading"
        @update:search="setSearch"
      >
        <template #start>
          <USelectMenu
            :model-value="selectedAccount"
            :items="accountOptions"
            label-key="label"
            value-key="value"
            :placeholder="t('select_account')"
            class="w-full sm:w-64"
            @update:model-value="handleAccountChange"
          />
        </template>

        <template #end>
          <UButton
            icon="i-lucide-refresh-cw"
            variant="ghost"
            color="neutral"
            :disabled="!selectedAccount || loading"
            @click="handleRefresh"
          >
            {{ t('refresh') }}
          </UButton>
        </template>
      </BaseCollectionToolbar>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="error"
    >
      <template #actions>
        <UButton :label="t('retry')" color="error" variant="soft" size="sm" @click="handleRetry" />
      </template>
    </UAlert>

    <BaseCollectionEmpty
      v-else-if="!loading && accounts.length === 0"
      icon="i-heroicons-user-plus"
      :title="t('no_accounts_title')"
      :hint="t('no_accounts_hint')"
    >
      <UButton to="/app/integrations" icon="i-lucide-plug" color="primary">
        {{ t('connect_account') }}
      </UButton>
    </BaseCollectionEmpty>

    <template v-else>
      <BaseCollectionList
        :items="filtered"
        :row-key="recommendationRowKey"
        :loading="loading"
        :empty-title="hasActiveFilters ? t('no_results') : t('empty_recommendations')"
        empty-icon="i-heroicons-inbox"
      >
        <template #item="{ item: rec }">
          <UAvatar :src="rec.avatar || undefined" :alt="rec.displayName || rec.handle" size="md" />

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-sm font-medium">
                {{ rec.displayName || rec.handle }}
              </p>
              <span class="text-xs text-muted">
                @{{ rec.handle }}
              </span>
              <UBadge :color="reasonColor(rec.reason)" variant="subtle" size="xs">
                {{ reasonBadge(rec.reason) }}
              </UBadge>
            </div>
            <p v-if="rec.description" class="mt-0.5 line-clamp-2 text-xs text-muted">
              {{ rec.description }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ t('score', { count: rec.score }) }}
              <span v-if="rec.followersCount !== undefined">
                · {{ t('followers_count', { count: rec.followersCount }) }}
              </span>
            </p>
          </div>

          <UButton
            :label="followLabel(rec.did)"
            color="primary"
            variant="soft"
            size="sm"
            class="shrink-0"
            :loading="followingDid === rec.did"
            :disabled="followingDid !== null"
            @click="() => handleFollow(rec.did)"
          />
        </template>

        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
            {{ t('clear_filters') }}
          </UButton>
        </template>
      </BaseCollectionList>

      <p class="mt-3 text-xs text-muted">{{ t('manual_note') }}</p>
    </template>

    <UModal v-model:open="showAbout" :title="t('about_title')" :description="t('about_description')">
      <template #body>
        <div class="space-y-4">
          <div>
            <h3 class="mb-2 text-sm font-semibold">{{ t('how_title') }}</h3>
            <ul class="space-y-2">
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-user-check" class="mt-0.5 size-4 shrink-0 text-primary" />
                <p class="text-sm text-muted">{{ t('how_1') }}</p>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-users" class="mt-0.5 size-4 shrink-0 text-primary" />
                <p class="text-sm text-muted">{{ t('how_2') }}</p>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-sparkles" class="mt-0.5 size-4 shrink-0 text-primary" />
                <p class="text-sm text-muted">{{ t('how_3') }}</p>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-hand" class="mt-0.5 size-4 shrink-0 text-primary" />
                <p class="text-sm text-muted">{{ t('how_4') }}</p>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-semibold">{{ t('about_sources_title') }}</h3>
            <p class="text-sm text-muted">{{ t('about_sources_body') }}</p>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-semibold">{{ t('about_scoring_title') }}</h3>
            <p class="text-sm text-muted">{{ t('about_scoring_body') }}</p>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-semibold">{{ t('about_manual_title') }}</h3>
            <p class="text-sm text-muted">{{ t('about_manual_body') }}</p>
          </div>
        </div>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
