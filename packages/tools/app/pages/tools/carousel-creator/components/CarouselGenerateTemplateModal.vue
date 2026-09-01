<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useAiTemplateGenerator } from '../composables/useAiTemplateGenerator'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const {
  prompt,
  slideCount,
  format,
  generating,
  error,
  generated,
  canGenerate,
  generate,
  applyGenerated,
  reset,
  dismiss,
} = useAiTemplateGenerator()

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

watch(open, (value) => {
  if (!value) reset()
})

const examples = computed(() => [
  t('aiTemplate.ex0'),
  t('aiTemplate.ex1'),
  t('aiTemplate.ex2'),
])

const pageItems = computed(() => [3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
  label: `${n} ${t('aiTemplate.pages')}`,
  value: n,
})))

function close(): void {
  open.value = false
}

function handleApplyAndClose(): void {
  applyGenerated()
  close()
}

function handleSaveOnly(): void {
  close()
}
</script>

<template>
  <UModal v-model:open="open" :title="t('aiTemplate.title')" :description="t('aiTemplate.description')" class="max-w-lg"
    @closed="dismiss">
    <template #body>
      <div class="space-y-4">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert"
          :title="t('aiTemplate.errorTitle')" :description="error" />

        <div v-if="generated" class="rounded-xl border border-success/30 bg-success/10 p-4 space-y-3"
          data-testid="ai-template-success">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-circle-check" class="w-5 h-5 text-success" />
            <p class="font-semibold text-highlighted">{{ t('aiTemplate.successTitle') }}</p>
          </div>
          <p class="text-sm text-muted">{{ t('aiTemplate.successDescription', { title: generated.title }) }}</p>
          <div class="flex flex-wrap items-center gap-1">
            <span class="text-[11px] font-mono px-2 py-1 rounded-full bg-elevated border border-default text-toned">
              {{ generated.slides.length }} {{ t('aiTemplate.pages') }}
            </span>
            <span v-for="slide in generated.slides" :key="slide.templateKey"
              class="text-[10px] px-1.5 py-0.5 rounded bg-accented text-toned">
              {{ slide.templateKey }}
            </span>
            <span v-if="generated.slides.some(s => (s as any).html)"
              class="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              HTML
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-muted">{{ t('style.palette') }}</span>
            <span class="h-4 w-4 rounded-full border border-white/20" :style="{ background: generated.palette.bg }" />
            <span class="h-4 w-4 rounded-full border border-white/20" :style="{ background: generated.palette.text }" />
            <span class="h-4 w-4 rounded-full border border-white/20"
              :style="{ background: generated.palette.accent }" />
          </div>
        </div>

        <template v-else>
          <UFormField :label="t('aiTemplate.promptLabel')" size="sm">
            <UTextarea v-model="prompt" :rows="4" :maxlength="10000" :placeholder="t('aiTemplate.promptPlaceholder')"
              class="w-full" data-testid="ai-template-prompt" />
          </UFormField>
          <div class="flex items-center justify-between gap-2 -mt-2">
            <p class="text-[11px] text-muted">{{ t('aiTemplate.promptHint') }}</p>
            <span class="text-[11px] font-mono text-muted">{{ prompt.length }}/600</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <UButton v-for="example in examples" :key="example" size="xs" color="neutral" variant="outline"
              :disabled="generating" data-testid="ai-template-example" @click="prompt = example">
              {{ example }}
            </UButton>
          </div>

          <UFormField :label="t('aiTemplate.pageLabel')" size="sm">
            <USelect v-model="slideCount" :items="pageItems" value-key="value" size="sm"
              data-testid="ai-template-pages" />
          </UFormField>

          <UFormField :label="t('aiTemplate.formatLabel')" size="sm">
            <USelect :model-value="format" :items="[
              { label: t('aiTemplate.formatHtml'), value: 'html' },
              { label: t('aiTemplate.formatStructured'), value: 'structured' },
            ]" value-key="value" size="sm" data-testid="ai-template-format" />
          </UFormField>
          <p class="text-[11px] text-muted">{{ t('aiTemplate.formatHint') }}</p>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <template v-if="generated">
          <UButton color="neutral" variant="ghost" :label="t('aiTemplate.saveOnly')"
            data-testid="btn-ai-template-save-only" @click="handleSaveOnly" />
          <UButton color="primary" icon="i-lucide-sparkles" :label="t('aiTemplate.apply')"
            data-testid="btn-ai-template-apply" @click="handleApplyAndClose" />
        </template>
        <template v-else>
          <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" :disabled="generating"
            @click="close" />
          <UButton color="primary" icon="i-lucide-wand-2" :loading="generating"
            :label="generating ? t('aiTemplate.generating') : t('aiTemplate.generate')" :disabled="!canGenerate"
            data-testid="btn-ai-template-generate" @click="generate" />
        </template>
      </div>
    </template>
  </UModal>
</template>
