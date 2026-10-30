<i18n src="./MagicImageGallery.json"></i18n>
<script lang="ts" setup>
/**
 * MagicImageGallery
 *
 * A lazy-loaded screenshot grid that opens a full-screen, chrome-free
 * lightbox. Arrow keys and previous/next buttons cycle the gallery, Escape
 * closes it, focus is trapped inside the lightbox and returned to the
 * thumbnail that opened it.
 *
 * The default image list is generated from every PNG in
 * `packages/doc/public/img/screenshots` and `screenshots-mobile`, served from
 * the VitePress base URL. Regenerate `app/data/magicImageGallery.ts` after
 * adding screenshots (see the multilingual-content-pages skill).
 *
 * @author MagicSync
 * @version 0.0.1
 */
import type { MagicGalleryImage } from '../data/magicImageGallery'
import { defaultGalleryImages, featuredGalleryImages } from '../data/magicImageGallery'

interface Props {
  /** Override the default generated screenshot list. */
  imageList?: MagicGalleryImage[]
  /** Use the curated marketing subset instead of the full screenshot list. */
  featured?: boolean
  /** Emit page SEO tags. Disable when embedded on a page with its own SEO. */
  seo?: boolean
  /** Visible heading. Falls back to the localized SEO title. */
  title?: string
  /** Visible description. Falls back to the localized SEO description. */
  description?: string
  /** `<title>` / OG title. Falls back to the visible heading. */
  seoTitle?: string
  /** Meta description / OG description. Falls back to the visible description. */
  seoDescription?: string
  /** Thumbnail columns on desktop. */
  columns?: 2 | 3 | 4
}

const props = withDefaults(defineProps<Props>(), {
  imageList: () => defaultGalleryImages,
  featured: false,
  seo: true,
  title: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
  columns: 4,
})

const { t } = useI18n()

const resolvedImages = computed(() => props.featured ? featuredGalleryImages : props.imageList)

const visibleTitle = computed(() => props.title || t('title'))
const visibleDescription = computed(() => props.description || t('description'))
const resolvedSeoTitle = computed(() => props.seoTitle || t('seoTitle'))
const resolvedSeoDescription = computed(() => props.seoDescription || t('seoDescription'))

if (props.seo) {
  useSeoMeta({
    title: () => resolvedSeoTitle.value,
    description: () => resolvedSeoDescription.value,
    ogTitle: () => resolvedSeoTitle.value,
    ogDescription: () => resolvedSeoDescription.value,
    ogImage: () => resolvedImages.value[0]?.large ?? '',
    ogType: 'website',
  })
}

const GRID_CLASSES: Record<NonNullable<Props['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-3 lg:grid-cols-4',
}

const gridClass = computed(() => GRID_CLASSES[props.columns] ?? GRID_CLASSES[4])

const isOpen = ref(false)
const position = ref(0)
const dialogRoot = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const lastTrigger = ref<HTMLElement | null>(null)

const current = computed(() => resolvedImages.value[position.value])
const counter = computed(() => t('counter', { current: position.value + 1, total: resolvedImages.value.length }))

function openAt(index: number, event: MouseEvent) {
  lastTrigger.value = event.currentTarget as HTMLElement
  position.value = index
  isOpen.value = true
  nextTick(() => closeButton.value?.focus())
}

function close() {
  isOpen.value = false
  nextTick(() => lastTrigger.value?.focus())
}

function step(by: number) {
  const total = resolvedImages.value.length
  if (total === 0) return
  position.value = (position.value + by + total) % total
}

function trapFocus(event: KeyboardEvent) {
  const buttons = Array.from(dialogRoot.value?.querySelectorAll<HTMLElement>('button') ?? [])
  if (buttons.length === 0) return
  const index = buttons.indexOf(document.activeElement as HTMLElement)
  const base = index === -1 ? 0 : index
  const next = (base + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === 'ArrowRight') step(1)
  else if (event.key === 'Tab') trapFocus(event)
}

watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <section class="py-12 lg:py-20" :aria-label="t('regionLabel')">
    <div class="mx-auto max-w-6xl px-4">
      <header class="max-w-3xl">
        <h2 class="text-2xl font-bold lg:text-3xl">
          <slot name="title">{{ visibleTitle }}</slot>
        </h2>
        <p class="mt-2 text-muted-foreground">
          <slot name="description">{{ visibleDescription }}</slot>
        </p>
      </header>

      <ul class="mt-6 grid grid-cols-2 gap-3" :class="gridClass">
        <li v-for="(image, index) in resolvedImages" :key="image.src">
          <button type="button"
            class="group block w-full overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-primary/50"
            :aria-label="t('openImage', { title: image.title })" @click="openAt(index, $event)">
            <img :src="image.src" :alt="image.alt || t('fallbackAlt')"
              class="aspect-video w-full object-cover object-top transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
              loading="lazy" decoding="async" />
          </button>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div v-if="isOpen && current" ref="dialogRoot" class="fixed inset-0 z-[200] flex flex-col bg-black text-white"
        role="dialog" aria-modal="true" :aria-label="current.title">
        <div class="flex items-center justify-between gap-4 px-4 py-3">
          <p class="truncate text-sm font-medium">{{ current.title }}</p>
          <button ref="closeButton" type="button"
            class="rounded-full p-2 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
            :aria-label="t('close')" @click="close">
            <Icon name="lucide:x" class="size-5" />
          </button>
        </div>

        <div class="relative flex min-h-0 flex-1 items-center justify-center px-12">
          <button type="button"
            class="absolute left-2 rounded-full bg-white/10 p-2 outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            :aria-label="t('previous')" @click="step(-1)">
            <Icon name="lucide:chevron-left" class="size-6" />
          </button>

          <img :src="current.large" :alt="current.alt" class="max-h-full max-w-full object-contain" loading="eager"
            decoding="async" />

          <button type="button"
            class="absolute right-2 rounded-full bg-white/10 p-2 outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            :aria-label="t('next')" @click="step(1)">
            <Icon name="lucide:chevron-right" class="size-6" />
          </button>
        </div>

        <div class="px-4 pb-4 text-center">
          <p class="text-sm text-white/80">{{ current.caption }}</p>
          <p class="mt-1 text-xs tabular-nums text-white/60" role="status" aria-live="polite">{{ counter }}</p>
        </div>
      </div>
    </Teleport>
  </section>
</template>
