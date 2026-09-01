<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '../composables/useCarouselDeck'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const toast = useToast()
const { addHtmlSlide, slides, MAX_CAROUSEL_SLIDES } = useCarouselDeck()

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const html = ref(`<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;gap:24px;padding:80px;font-family:Arial,sans-serif;color:#fafaf9">
  <div style="font-size:26px;letter-spacing:0.3em;text-transform:uppercase;color:#f97316;font-weight:700">YOUR HTML</div>
  <div style="font-size:72px;font-weight:900;line-height:1.05">Paste your own<br>slide HTML here</div>
  <div style="font-size:28px;opacity:0.8">Inline styles only — it renders at 1080×1350.</div>
</div>`)

const canCreate = computed(() => html.value.trim().length > 0 && slides.value.length < MAX_CAROUSEL_SLIDES)

function handleCreate(): void {
  if (!canCreate.value) return
  addHtmlSlide(html.value)
  toast.add({ title: t('fromHtml.createdTitle'), description: t('fromHtml.createdDesc'), color: 'success' })
  open.value = false
}

watch(open, (value) => {
  if (!value) html.value = ''
})
</script>

<template>
  <UModal v-model:open="open" :title="t('fromHtml.title')" :description="t('fromHtml.description')" class="max-w-xl" :dismissible="false"
    :ui="{ overlay: 'bg-black/60' }"
    data-testid="from-html-modal">
    <template #body>
      <div class="space-y-4">
        <div class="rounded-xl border border-default bg-muted p-3">
          <p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{{ t('fromHtml.preview') }}</p>
          <div class="relative mx-auto aspect-[4/5] w-40 overflow-hidden rounded-lg border border-default bg-muted"
            data-testid="from-html-preview">
            <div class="absolute top-0 left-0 origin-top-left" :style="{ width: '1080px', height: '1350px', transform: 'scale(0.148)' }"
              v-html="html" />
          </div>
        </div>
        <UFormField :label="t('fromHtml.html')" size="xs">
          <UTextarea v-model="html" :rows="9" class="w-full font-mono text-xs" data-testid="from-html-input"
            :placeholder="t('fromHtml.placeholder')" />
        </UFormField>
        <p class="text-[11px] text-muted">{{ t('fromHtml.hint') }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" @click="open = false" />
        <UButton color="primary" icon="i-lucide-code-2" :label="t('fromHtml.create')" :disabled="!canCreate"
          data-testid="btn-from-html-create" @click="handleCreate" />
      </div>
    </template>
  </UModal>
</template>