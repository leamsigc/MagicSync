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
const { addImageSlicesSlide, slides, MAX_CAROUSEL_SLIDES } = useCarouselDeck()

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const imageUrl = ref('')
const imageName = ref('')
const count = ref(3)
const direction = ref<'vertical' | 'horizontal'>('vertical')
const padding = ref(0)
const backdropColor = ref('#0f0e0d')
const fileInput = ref<HTMLInputElement | null>(null)

const room = computed(() => MAX_CAROUSEL_SLIDES - slides.value.length)
const actualCount = computed(() => Math.min(count.value, Math.max(room.value, 0)))
const canCreate = computed(() => !!imageUrl.value && room.value > 0)

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageUrl.value = URL.createObjectURL(file)
  imageName.value = file.name
  input.value = ''
}

function handleCreate(): void {
  if (!canCreate.value) {
    if (room.value <= 0) {
      toast.add({ title: t('fromImage.limitTitle'), description: t('fromImage.limitDesc'), color: 'warning' })
    }
    return
  }
  addImageSlicesSlide(imageUrl.value, actualCount.value, direction.value, { padding: padding.value, backdropColor: backdropColor.value })
  toast.add({
    title: t('fromImage.createdTitle'),
    description: t('fromImage.createdDesc', { count: actualCount.value }),
    color: 'success',
  })
  open.value = false
  imageUrl.value = ''
  count.value = 3
  padding.value = 0
}

watch(open, (value) => {
  if (!value) {
    imageUrl.value = ''
    count.value = 3
    padding.value = 0
  }
})
</script>

<template>
  <UModal v-model:open="open" :title="t('fromImage.title')" :description="t('fromImage.description')" class="max-w-lg"
    :ui="{ overlay: 'bg-black/60' }" :dismissible="false"
    data-testid="from-image-modal">
    <template #body>
      <div class="space-y-4">
        <div v-if="!imageUrl" class="rounded-xl border-2 border-dashed border-default p-8 text-center space-y-3"
          data-testid="from-image-drop">
          <UIcon name="i-lucide-image-plus" class="mx-auto size-8 text-muted" />
          <p class="text-sm text-muted">{{ t('fromImage.dropHint') }}</p>
          <UButton variant="soft" color="primary" icon="i-lucide-upload" :label="t('fromImage.choose')"
            data-testid="btn-from-image-choose" @click="fileInput?.click()" />
        </div>

        <div v-else class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs text-muted truncate">{{ imageName }}</p>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-rotate-ccw"
              :label="t('fromImage.change')" data-testid="btn-from-image-change" @click="fileInput?.click()" />
          </div>

          <!-- Split preview -->
          <div class="relative w-2/3 mx-auto max-h-64 overflow-hidden rounded-lg border border-default"
            :style="{ backgroundColor: backdropColor }" data-testid="from-image-preview">
            <div class="absolute inset-0" :style="{ padding: `${padding}px`, backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundClip: 'content-box' }" />
            <div v-if="direction === 'vertical'" class="absolute" :style="{ inset: `${padding}px`, display: 'grid', gridTemplateRows: `repeat(${actualCount}, 1fr)` }">
              <span v-for="i in actualCount" :key="i" class="border-b border-dashed border-white/60 last:border-b-0" />
            </div>
            <div v-else class="absolute" :style="{ inset: `${padding}px`, display: 'grid', gridTemplateColumns: `repeat(${actualCount}, 1fr)` }">
              <span v-for="i in actualCount" :key="i" class="border-r border-dashed border-white/60 last:border-r-0" />
            </div>
            <span class="absolute top-2 left-2 rounded-full bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 border border-white/10">
              {{ actualCount }} {{ t('fromImage.slides') }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="t('fromImage.direction')" size="xs">
              <div class="grid grid-cols-2 gap-1.5">
                <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-arrow-down-wide-narrow"
                  :class="direction === 'vertical' ? 'ring-1 ring-primary' : ''" :label="t('fromImage.vertical')"
                  data-testid="from-image-vertical" @click="() => direction = 'vertical'" />
                <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-arrow-left-right"
                  :class="direction === 'horizontal' ? 'ring-1 ring-primary' : ''" :label="t('fromImage.horizontal')"
                  data-testid="from-image-horizontal" @click="() => direction = 'horizontal'" />
              </div>
            </UFormField>
            <UFormField :label="t('fromImage.slices')" size="xs">
              <USlider :model-value="count" :min="1" :max="9" :step="1" class="mt-3"
                :data-testid="`from-image-count-${count}`" @update:model-value="(v: number | undefined) => count = v ?? 3" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="`${t('fromImage.padding')} (${padding}px)`" size="xs">
              <USlider :model-value="padding" :min="0" :max="40" :step="2" data-testid="from-image-padding"
                @update:model-value="(v: number | undefined) => padding = v ?? 0" />
            </UFormField>
            <UFormField :label="t('fromImage.backdropColor')" size="xs">
              <div class="flex items-center gap-2">
                <input :value="backdropColor" type="color" class="h-7 w-10 cursor-pointer rounded border border-default bg-transparent" data-testid="from-image-backdrop" @input="(e: Event) => backdropColor = (e.target as HTMLInputElement).value" />
                <span class="text-[10px] font-mono text-muted">{{ backdropColor }}</span>
              </div>
            </UFormField>
          </div>
          <p class="text-[11px] text-muted">{{ t('fromImage.hint') }}</p>
        </div>
      </div>
      <input ref="fileInput" type="file" accept="image/*" class="hidden" data-testid="from-image-input"
        @change="onFileChange" />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" @click="open = false" />
        <UButton color="primary" icon="i-lucide-scissors" :label="t('fromImage.create')" :disabled="!canCreate"
          data-testid="btn-from-image-create" @click="handleCreate" />
      </div>
    </template>
  </UModal>
</template>