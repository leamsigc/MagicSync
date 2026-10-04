<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { contentApiError } from '../../../../utils/content-api-error'

/**
 * The scan dialog (PRD-CONTENT-PIPELINE-OVERHAUL §10 D01): an optional topic, the
 * platform choice, one confirm. It is a blog post either way — the platforms only
 * decide which versions come back (D07), so nothing here asks for a format.
 *
 * The platform list is the server's catalog, fetched the first time the dialog
 * opens; no platform is hardcoded here. While the scan runs the dialog cannot be
 * dismissed, so a slow run cannot leave an orphaned request behind.
 */

interface ContentPlatformOption {
  name: string
  display_name: string
}

const props = defineProps<{ busy: boolean }>()

const emit = defineEmits<{
  scan: [request: { topic: string, platforms: string[] }]
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()

const topic = ref('')
const platforms = ref<ContentPlatformOption[]>([])
const selected = ref<string[]>([])
const loadingPlatforms = ref(false)
const catalogLoaded = ref(false)

const canConfirm = computed(() => selected.value.length > 0 && !props.busy)

async function loadPlatforms() {
  if (catalogLoaded.value) return
  loadingPlatforms.value = true
  try {
    platforms.value = await $fetch<ContentPlatformOption[]>('/api/ai-tools/social-media/platforms')
    catalogLoaded.value = true
  }
  catch (error) {
    log.error({ message: 'platform catalog failed to load', error: String(error) })
    toast.add({ title: t('scan.platformsFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    loadingPlatforms.value = false
  }
}

function isSelected(name: string): boolean {
  return selected.value.includes(name)
}

function handleTogglePlatform(name: string) {
  selected.value = isSelected(name)
    ? selected.value.filter(entry => entry !== name)
    : [...selected.value, name]
}

function handleCancel() {
  if (props.busy) return
  open.value = false
}

/** A blank topic is not an error: the server then scans the business itself. */
function handleConfirm() {
  if (!canConfirm.value) return
  emit('scan', { topic: topic.value.trim(), platforms: [...selected.value] })
}

function handleTopicKey(event: KeyboardEvent) {
  if (event.key === 'Enter') handleConfirm()
}

watch(open, (value) => {
  if (value) void loadPlatforms()
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('scan.title')"
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4" data-testid="scan-modal">
        <UFormField :label="t('scan.topicLabel')" :hint="t('scan.hint')" name="scan-topic">
          <UInput
            v-model="topic"
            :placeholder="t('scan.topicPlaceholder')"
            class="w-full"
            :disabled="busy"
            data-testid="scan-topic"
            @keyup.enter="handleTopicKey"
          />
        </UFormField>

        <div>
          <p class="text-sm font-medium text-highlighted">
            {{ t('scan.platforms') }}
          </p>
          <p class="mt-0.5 text-xs text-muted">
            {{ t('scan.platformsHint') }}
          </p>

          <div v-if="loadingPlatforms" v-motion-fade :duration="200" class="mt-3 flex items-center gap-2 text-xs text-muted" data-testid="scan-platforms-loading">
            <UIcon name="i-heroicons-arrow-path" class="size-4 animate-spin" />
            {{ t('scan.platformsLoading') }}
          </div>
          <p v-else-if="platforms.length === 0" v-motion-fade :duration="200" class="mt-3 text-xs text-muted" data-testid="scan-platforms-empty">
            {{ t('scan.platformsEmpty') }}
          </p>
          <div v-else class="mt-3 grid gap-2 sm:grid-cols-2">
            <UCheckbox
              v-for="platform in platforms"
              :key="platform.name"
              :model-value="isSelected(platform.name)"
              :label="platform.display_name"
              :disabled="busy"
              :data-testid="`scan-platform-${platform.name}`"
              @update:model-value="() => handleTogglePlatform(platform.name)"
            />
          </div>

          <p v-if="selected.length === 0" v-motion-fade :duration="200" class="mt-2 text-xs text-warning" data-testid="scan-platforms-need-one">
            {{ t('scan.platformsNeedOne') }}
          </p>
        </div>

        <p v-if="busy" v-motion-fade :duration="200" class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="scan-progress">
          <UIcon name="i-heroicons-arrow-path" class="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
          <span>
            <span class="block text-sm font-medium text-highlighted">{{ t('scan.running') }}</span>
            <span class="mt-0.5 block text-xs text-muted">{{ t('scan.runningHint') }}</span>
          </span>
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('scan.cancel')"
          :disabled="busy"
          data-testid="scan-cancel"
          @click="handleCancel"
        />
        <UButton
          color="primary"
          icon="i-heroicons-magnifying-glass"
          :label="t('scan.submit')"
          :loading="busy"
          :disabled="!canConfirm"
          data-testid="scan-confirm"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>