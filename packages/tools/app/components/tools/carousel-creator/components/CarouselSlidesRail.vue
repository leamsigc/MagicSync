<i18n src="#site/app/pages/tools/carousel-creator/carousel-creator.json"></i18n>
<script lang="ts" setup>
import { CAROUSEL_SLIDE_TEMPLATES } from '../../../../../../ui/app/utils/slideTemplates'
import { useCarouselDeck } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'
import CarouselFromImageModal from './CarouselFromImageModal.vue'
import CarouselFromHtmlModal from './CarouselFromHtmlModal.vue'

const {
  slides,
  currentIndex,
  slideHtml,
  addSlide,
  insertSlideAt,
  duplicateSlide,
  removeSlide,
  moveSlide,
  switchTo,
  showFromImageModal: fromImageOpen,
  showFromHtmlModal: fromHtmlOpen,
} = useCarouselDeck()

const { t } = useI18n()

const canAddMore = computed(() => slides.value.length < 10)
const addOpen = ref(false)

function handleAddWithTemplate(key: string): void {
  insertSlideAt(currentIndex.value + 1, key)
  addOpen.value = false
}

function handleAddBlank(): void {
  addSlide()
  addOpen.value = false
}

function openFromImage(): void {
  addOpen.value = false
  fromImageOpen.value = true
}

function openFromHtml(): void {
  addOpen.value = false
  fromHtmlOpen.value = true
}
</script>

<template>
  <section class="space-y-3" data-testid="slide-manager" :aria-label="t('slide.manager')">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">
        {{ t('slide.label') }}
      </p>
      <div class="flex items-center gap-2">
        <UBadge variant="outline" color="neutral" size="sm" class="font-mono">
          {{ slides.length }}/10
        </UBadge>
        <UPopover v-model:open="addOpen">
          <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus"
            :label="t('slide.addPage')" :disabled="!canAddMore" data-testid="btn-add-page" />
          <template #content>
            <div class="w-80 p-2 space-y-2">
              <p class="text-xs font-semibold text-toned px-1">{{ t('slide.addPage') }}</p>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" data-testid="template-chooser-blank"
                  class="rounded-lg border border-dashed border-default hover:border-primary/60 hover:bg-muted p-2 text-left transition-colors flex flex-col gap-1 items-center justify-center min-h-[72px]"
                  @click="handleAddBlank">
                  <Icon name="i-lucide-file-plus" class="w-5 h-5 text-muted" />
                  <span class="text-[11px] font-medium text-toned">{{ t('templates.blankPage') }}</span>
                </button>
                <button type="button" data-testid="template-chooser-image"
                  class="rounded-lg border border-default hover:border-primary/50 hover:bg-muted p-2 text-left transition-colors flex flex-col gap-1 items-center justify-center min-h-[72px]"
                  @click="openFromImage">
                  <Icon name="i-lucide-scissors" class="w-5 h-5 text-muted" />
                  <span class="text-[11px] font-medium text-toned">{{ t('fromImage.title') }}</span>
                </button>
                <button type="button" data-testid="template-chooser-html"
                  class="rounded-lg border border-default hover:border-primary/50 hover:bg-muted p-2 text-left transition-colors flex flex-col gap-1 items-center justify-center min-h-[72px]"
                  @click="openFromHtml">
                  <Icon name="i-lucide-code-2" class="w-5 h-5 text-muted" />
                  <span class="text-[11px] font-medium text-toned">{{ t('fromHtml.title') }}</span>
                </button>
              </div>
              <USeparator />
              <p class="text-xs font-semibold text-toned px-1">{{ t('templates.chooseLayout') }}</p>
              <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                <button v-for="tpl in CAROUSEL_SLIDE_TEMPLATES" :key="tpl.key"
                  :data-testid="`template-chooser-${tpl.key}`" type="button"
                  class="rounded-lg border border-default hover:border-primary/50 hover:bg-muted p-2 text-left transition-colors"
                  @click="() => handleAddWithTemplate(tpl.key)">
                  <span class="block text-xs font-medium text-highlighted truncate">{{ tpl.title }}</span>
                  <span class="block text-[10px] text-muted line-clamp-2 leading-tight">{{ tpl.description }}</span>
                </button>
              </div>
              <p class="text-[10px] text-muted px-1">{{ t('slide.insertHint') }}</p>
            </div>
          </template>
        </UPopover>
      </div>
    </div>

    <ol class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
      <li v-for="(slide, index) in slides" :key="slide.id" :data-active="index === currentIndex"
        class="group relative">
        <div class="relative rounded-lg overflow-hidden border transition-colors"
          :class="index === currentIndex ? 'border-primary ring-2 ring-primary/50' : 'border-default hover:border-primary/50'">
          <button type="button" :data-testid="`slide-thumb-${index}`"
            class="block w-full aspect-[4/5] bg-muted overflow-hidden"
            :aria-label="`${t('slide.goTo')} ${index + 1}`" @click="() => switchTo(index)">
            <div class="origin-top-left pointer-events-none" :style="{ width: '1080px', height: '1350px', transform: 'scale(0.082)' }"
              v-html="slideHtml(slide, index, slides.length)" />
          </button>
          <span class="absolute top-1 left-1 text-[10px] font-mono px-1 rounded bg-black/70 text-highlighted border border-white/10">
            {{ String(index + 1).padStart(2, '0') }} · {{ slide.templateKey }}
          </span>
          <span class="absolute top-1 right-1 hidden sm:flex">
            <UDropdownMenu
              :items="[[{ label: t('slide.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicateSlide(index), disabled: slides.length >= 10 }, { label: t('slide.insertAfter'), icon: 'i-lucide-plus', onSelect: () => insertSlideAt(index + 1), disabled: slides.length >= 10 }, { label: t('slide.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeSlide(index), disabled: slides.length <= 1 }]]">
              <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-ellipsis" :aria-label="t('slide.manage')" class="bg-black/60 backdrop-blur" />
            </UDropdownMenu>
          </span>
          <div class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/80 py-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
            <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-arrow-up"
              :disabled="index === 0" data-testid="btn-move-up" :aria-label="t('slide.moveUp')"
              @click="() => moveSlide(index, -1)" />
            <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-copy"
              :disabled="slides.length >= 10" data-testid="btn-duplicate-slide" :aria-label="t('slide.duplicate')"
              @click="() => duplicateSlide(index)" />
            <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-trash-2"
              :disabled="slides.length <= 1" data-testid="btn-remove-slide" :aria-label="t('slide.delete')"
              @click="() => removeSlide(index)" />
            <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-arrow-down"
              :disabled="index === slides.length - 1" data-testid="btn-move-down" :aria-label="t('slide.moveDown')"
              @click="() => moveSlide(index, 1)" />
          </div>
        </div>
        <div v-if="index < slides.length - 1" class="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10">
          <UTooltip :text="t('slide.insertAfter')">
            <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-plus"
              :disabled="!canAddMore" :data-testid="`btn-insert-after-${index}`"
              class="h-6 w-6 rounded-full bg-muted border border-default opacity-0 group-hover:opacity-100 transition-opacity"
              @click="() => insertSlideAt(index + 1)" />
          </UTooltip>
        </div>
      </li>

      <li class="shrink-0">
        <button type="button" data-testid="btn-add-slide" :disabled="!canAddMore"
          class="w-full aspect-[4/5] rounded-lg border-2 border-dashed border-default hover:border-primary/60 hover:text-primary text-muted transition-colors flex flex-col items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none min-h-[110px]"
          :aria-label="t('slide.add')" @click="() => addSlide()">
          <Icon name="i-lucide-plus" class="w-5 h-5" />
          <span class="text-[11px] font-medium">{{ t('slide.add') }}</span>
          <span class="text-[9px] text-muted">Blank</span>
        </button>
      </li>
    </ol>

    <p class="text-[10px] text-muted leading-relaxed">{{ t('slide.manageHint') }}</p>

    <CarouselFromImageModal v-model:open="fromImageOpen" />
    <CarouselFromHtmlModal v-model:open="fromHtmlOpen" />
  </section>
</template>