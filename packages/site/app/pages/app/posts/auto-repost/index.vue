<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Auto-Repost configuration page.
 * Configure same-platform reposting (interval, max count) for a published post.
 */
import { useAutoRepost, type AutoRepostConfig } from '~/composables/useAutoRepost'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { loading, error, configure, getConfig } = useAutoRepost()

const postId = ref((route.query.postId as string) || '')
const enabled = ref(true)
const intervalHours = ref(24)
const maxReposts = ref(3)
const currentConfig = ref<AutoRepostConfig | null>(null)

const handleLoad = async () => {
  if (!postId.value) return
  const cfg = await getConfig(postId.value)
  currentConfig.value = cfg
  if (cfg) {
    enabled.value = cfg.enabled
    intervalHours.value = cfg.intervalHours
    maxReposts.value = cfg.maxReposts
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
  <div class="mx-auto max-w-2xl space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('title') }}</h1>
      <p class="text-gray-500">{{ t('description') }}</p>
    </div>

    <UCard>
      <div class="space-y-4">
        <UFormField label="Post ID" name="postId">
          <UInput v-model="postId" placeholder="post_..." class="w-full" />
        </UFormField>

        <div class="flex gap-2">
          <UButton :loading="loading" variant="outline" @click="() => handleLoad()">
            {{ t('currentCount') }}
          </UButton>
        </div>

        <div class="flex items-center justify-between">
          <span>{{ enabled ? t('enabled') : t('disabled') }}</span>
          <USwitch :model-value="enabled" @update:model-value="() => handleToggleEnabled()" />
        </div>

        <UFormField :label="t('intervalHours')" name="intervalHours">
          <UInput v-model.number="intervalHours" type="number" :min="1" :max="168" />
        </UFormField>

        <UFormField :label="t('maxReposts')" name="maxReposts">
          <UInput v-model.number="maxReposts" type="number" :min="1" :max="20" />
        </UFormField>

        <div v-if="currentConfig" class="text-sm text-gray-500 space-y-1">
          <p>{{ t('currentCount') }}: {{ currentConfig.currentCount }}</p>
          <p v-if="currentConfig.nextRepostAt">{{ t('nextRepostAt') }}: {{ currentConfig.nextRepostAt }}</p>
        </div>
        <p v-else class="text-sm text-gray-400">{{ t('noConfig') }}</p>

        <UButton :loading="loading" color="primary" @click="() => handleSave()">
          {{ loading ? t('saving') : t('save') }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>
