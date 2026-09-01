<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck, type AiDesignResult } from '../composables/useCarouselDeck'

const emit = defineEmits<{ generated: [] }>()

const {
  applyAiDesign,
  palette,
} = useCarouselDeck()

const { t, locale } = useI18n()
const { loggedIn } = UseUser()

const topic = ref('')
const tone = ref('educational')
const slideCount = ref(5)
const generating = ref(false)

const toneItems = computed(() => [
  { label: t('ai.tone.educational'), value: 'educational' },
  { label: t('ai.tone.professional'), value: 'professional' },
  { label: t('ai.tone.friendly'), value: 'friendly' },
  { label: t('ai.tone.humorous'), value: 'humorous' },
  { label: t('ai.tone.promotional'), value: 'promotional' },
])

async function generate(): Promise<void> {
  if (!topic.value.trim() || generating.value) return
  generating.value = true
  try {
    const result = await $fetch<AiDesignResult>('/api/v1/ai/carousel-design', {
      method: 'POST',
      body: {
        topic: topic.value.trim().slice(0, 500),
        slideCount: slideCount.value,
        tone: tone.value,
        language: locale.value,
      },
    })
    applyAiDesign(result)
    emit('generated')
  }
  catch (error: unknown) {
    handleGenerateError(error)
  }
  finally {
    generating.value = false
  }
}

function handleGenerateError(error: unknown): void {
  const shape = error as { status?: number, statusCode?: number, data?: { message?: string } }
  const status = shape?.status ?? shape?.statusCode
  const isAuth = status === 401 || status === 403
  useToast().add({
    title: isAuth ? t('toasts.loginRequired') : t('ai.failedTitle'),
    description: isAuth ? undefined : shape?.data?.message,
    color: isAuth ? 'warning' : 'error',
  })
}
</script>

<template>
  <div class="space-y-3" data-testid="ai-panel">
    <template v-if="loggedIn">
      <UFormField :label="t('ai.topic')" size="xs">
        <UTextarea v-model="topic" :placeholder="t('ai.topicPlaceholder')" :rows="3" :maxlength="10000"
          class="w-full" />
      </UFormField>

      <div class="grid grid-cols-2 gap-2">
        <UFormField :label="t('ai.tone.label')" size="xs">
          <USelect v-model="tone" :items="toneItems" value-key="value" size="sm" class="w-full" />
        </UFormField>
        <UFormField :label="t('ai.slideCount')" size="xs">
          <UInput v-model.number="slideCount" type="number" :min="3" :max="10" size="sm" class="w-full" />
        </UFormField>
      </div>

      <UButton data-testid="btn-ai-generate" block icon="i-lucide-sparkles" :loading="generating"
        :disabled="!topic.trim()" @click="generate">
        {{ t('ai.generate') }}
      </UButton>
      <p class="text-[11px] text-muted leading-relaxed">
        {{ t('ai.hint') }}
      </p>
    </template>

    <div v-else class="rounded-lg border border-dashed border-neutral-600 p-4 text-center space-y-2">
      <Icon name="i-lucide-sparkles" class="mx-auto opacity-60" />
      <p class="text-xs text-muted">{{ t('toasts.loginRequired') }}</p>
      <UButton :label="t('login')" size="xs" to="/login" />
    </div>

    <USeparator />
    <p class="text-[11px] text-muted">
      {{ t('ai.currentPalette', { bg: palette.bg, accent: palette.accent }) }}
    </p>
  </div>
</template>
