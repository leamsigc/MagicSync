<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Component Description: Grow page — Bluesky follow recommendations
 * (follow-backs + network suggestions). All follows are manual.
 */
import { computed, ref } from 'vue'
import { useGrow } from '~/composables/useGrow'

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

const accountOptions = computed(() => [
  { label: t('select_account'), value: undefined },
  ...accounts.value.map((a) => ({ label: a.accountName, value: a.id })),
])

const handleAccountChange = (accountId: string | { label?: string; value?: string } | undefined) => {
  // USelectMenu emits the whole option object unless value-key resolves it —
  // normalize so we never fetch with "[object Object]".
  const id = typeof accountId === 'string' ? accountId : accountId?.value
  selectedAccount.value = id
  if (id) {
    fetchRecommendations(id)
  }
}

const handleFollow = async (did: string) => {
  if (!selectedAccount.value) return
  try {
    await followAccount(selectedAccount.value, did)
  } catch {
    // Error surfaced via error state
  }
}

const handleRetry = () => {
  if (selectedAccount.value) {
    fetchRecommendations(selectedAccount.value)
  } else {
    handleTabOpen()
  }
}

const handleRefresh = () => {
  if (selectedAccount.value) {
    fetchRecommendations(selectedAccount.value)
  }
}

const handleOpenAbout = () => {
  showAbout.value = true
}

const handleTabOpen = async () => {
  await fetchAccounts()
  const first = accounts.value[0]
  if (first && !selectedAccount.value) {
    handleAccountChange(first.id)
  }
}

const reasonBadge = (reason: string) => {
  return reason === 'follow-back' ? t('follow_back_badge') : t('suggested_badge')
}

const reasonColor = (reason: string): 'primary' | 'neutral' => {
  return reason === 'follow-back' ? 'primary' : 'neutral'
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
  <UContainer class="py-8 max-w-6xl">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
        <p class="text-muted-foreground">{{ t('description') }}</p>
      </div>
      <UButton variant="ghost" icon="i-lucide-circle-help" @click="handleOpenAbout">
        {{ t('learn_more') }}
      </UButton>
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-2">
      <USelectMenu
        :model-value="selectedAccount"
        :items="accountOptions"
        label-key="label"
        value-key="value"
        :placeholder="t('select_account')"
        class="w-64"
        @update:model-value="handleAccountChange"
      />
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        :disabled="!selectedAccount || loading"
        @click="handleRefresh"
      >
        {{ t('refresh') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="error"
      class="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20"
    >
      <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto h-8 w-8 text-red-400" />
      <p class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <UButton
        :label="t('retry')"
        color="red"
        variant="soft"
        class="mt-4"
        @click="handleRetry"
      />
    </div>

    <div
      v-else-if="accounts.length === 0"
      class="rounded-lg bg-muted/50 p-12 text-center"
    >
      <UIcon
        name="i-heroicons-user-plus"
        class="mx-auto h-12 w-12 text-muted-foreground"
      />
      <p class="mt-4 text-sm font-medium">{{ t('no_accounts_title') }}</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('no_accounts_hint') }}</p>
      <UButton to="/app/integrations" icon="i-lucide-plug" color="primary" class="mt-6">
        {{ t('connect_account') }}
      </UButton>
    </div>

    <div
      v-else-if="recommendations.length === 0"
      class="rounded-lg bg-muted/50 p-12 text-center"
    >
      <UIcon
        name="i-heroicons-inbox"
        class="mx-auto h-12 w-12 text-muted-foreground"
      />
      <p class="mt-4 text-sm text-muted-foreground">{{ t('empty_recommendations') }}</p>
    </div>

    <UCard v-else>
      <div class="divide-y divide-default">
        <div
          v-for="rec in recommendations"
          :key="rec.did"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="flex min-w-0 items-center gap-3">
            <UAvatar :src="rec.avatar || undefined" :alt="rec.displayName || rec.handle" size="md" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-medium">
                  {{ rec.displayName || rec.handle }}
                </p>
                <span class="text-xs text-muted-foreground">
                  @{{ rec.handle }}
                </span>
                <UBadge :color="reasonColor(rec.reason)" variant="subtle" size="xs">
                  {{ reasonBadge(rec.reason) }}
                </UBadge>
              </div>
              <p v-if="rec.description" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {{ rec.description }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ t('score', { count: rec.score }) }}
                <span v-if="rec.followersCount !== undefined">
                  · {{ t('followers_count', { count: rec.followersCount }) }}
                </span>
              </p>
            </div>
          </div>

          <UButton
            :label="followingDid === rec.did ? t('following') : t('follow')"
            color="primary"
            variant="soft"
            size="sm"
            class="shrink-0"
            :loading="followingDid === rec.did"
            :disabled="followingDid !== null"
            @click="handleFollow(rec.did)"
          />
        </div>
      </div>
      <template #footer>
        <p class="text-xs text-muted-foreground">{{ t('manual_note') }}</p>
      </template>
    </UCard>

    <UModal v-model:open="showAbout" :title="t('about_title')" :description="t('about_description')">
      <template #body>
        <div class="space-y-4">
          <div>
            <h3 class="mb-2 text-sm font-semibold">{{ t('how_title') }}</h3>
            <ul class="space-y-2">
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-user-check" class="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <p class="text-sm text-muted-foreground">{{ t('how_1') }}</p>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-users" class="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <p class="text-sm text-muted-foreground">{{ t('how_2') }}</p>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-sparkles" class="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <p class="text-sm text-muted-foreground">{{ t('how_3') }}</p>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-lucide-hand" class="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <p class="text-sm text-muted-foreground">{{ t('how_4') }}</p>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-semibold">{{ t('about_sources_title') }}</h3>
            <p class="text-sm text-muted-foreground">{{ t('about_sources_body') }}</p>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-semibold">{{ t('about_scoring_title') }}</h3>
            <p class="text-sm text-muted-foreground">{{ t('about_scoring_body') }}</p>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-semibold">{{ t('about_manual_title') }}</h3>
            <p class="text-sm text-muted-foreground">{{ t('about_manual_body') }}</p>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<style scoped></style>
