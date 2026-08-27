<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import CarouselStage from './CarouselStage.vue'

defineProps<{
  html: string
  width: number
  height: number
  guides?: boolean
  fxStyle?: string
  platform: 'instagram' | 'linkedin'
  currentIndex: number
  total: number
  handle: string
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Instagram preview -->
  <div v-if="platform === 'instagram'" class="w-full flex justify-center" data-testid="preview-instagram">
    <div class="w-full max-w-[420px] bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-2xl">
      <!-- IG header -->
      <div class="flex items-center justify-between px-3 py-2.5 bg-white">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-[2px]">
            <div class="h-full w-full rounded-full bg-white flex items-center justify-center text-[11px] font-bold text-neutral-800">
              {{ (handle || 'YH').slice(0, 2).toUpperCase() }}
            </div>
          </div>
          <div class="leading-tight">
            <p class="text-[13px] font-semibold text-neutral-900 flex items-center gap-1">
              {{ handle ? handle.replace(/^@/, '') : 'yourhandle' }}
              <Icon name="i-lucide-badge-check" class="w-3 h-3 text-blue-500 fill-blue-500" />
            </p>
            <p class="text-[11px] text-muted">Original audio</p>
          </div>
        </div>
        <Icon name="i-lucide-ellipsis" class="w-4 h-4 text-neutral-700" />
      </div>

      <!-- Stage with IG chrome -->
      <div class="relative bg-inverted">
        <CarouselStage :html="html" :width="width" :height="height" :guides="false" :fx-style="fxStyle" />
        <!-- IG 1/N badge top-right -->
        <span class="absolute top-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-highlighted backdrop-blur">
          {{ currentIndex + 1 }}/{{ total }}
        </span>
        <!-- tap areas -->
        <div class="absolute inset-y-0 left-0 w-1/3" />
        <div class="absolute inset-y-0 right-0 w-1/3" />
      </div>

      <!-- IG footer -->
      <div class="bg-white px-3 py-3 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3.5">
            <Icon name="i-lucide-heart" class="w-[22px] h-[22px] text-neutral-900" />
            <Icon name="i-lucide-message-circle" class="w-[22px] h-[22px] text-neutral-900" />
            <Icon name="i-lucide-send" class="w-[22px] h-[22px] text-neutral-900" />
          </div>
          <Icon name="i-lucide-bookmark" class="w-[22px] h-[22px] text-neutral-900" />
        </div>
        <!-- dots -->
        <div class="flex items-center justify-center gap-1 py-1" data-testid="ig-dots">
          <span
            v-for="i in total"
            :key="i"
            class="h-1.5 rounded-full transition-all"
            :class="i - 1 === currentIndex ? 'w-5 bg-sky-500' : 'w-1.5 bg-neutral-300'"
          />
        </div>
        <div class="space-y-1">
          <p class="text-[13px] font-semibold text-neutral-900">1,234 likes</p>
          <p class="text-[13px] leading-snug text-neutral-900 line-clamp-2">
            <span class="font-semibold">{{ handle ? handle.replace(/^@/, '') : 'yourhandle' }}</span>
            {{ t('preview.igCaption', 'Swipe to see the full story — which slide is your favourite?') }}
            <span class="text-muted">... more</span>
          </p>
          <p class="text-[11px] text-muted">{{ t('preview.igComments', 'View all 42 comments') }}</p>
          <p class="text-[10px] tracking-widest text-muted uppercase">2 hours ago · {{ t('preview.igTranslate', 'See translation') }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- LinkedIn preview -->
  <div v-else-if="platform === 'linkedin'" class="w-full flex justify-center" data-testid="preview-linkedin">
    <div class="w-full max-w-[540px] bg-white rounded-xl overflow-hidden border border-neutral-200 shadow-xl">
      <!-- LinkedIn header -->
      <div class="px-3 py-3 bg-white">
        <div class="flex items-start justify-between gap-3">
          <div class="flex gap-2.5">
            <div class="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-highlighted shrink-0">
              {{ (handle || 'YH').slice(0, 2).toUpperCase() }}
            </div>
            <div class="leading-tight">
              <p class="text-[14px] font-semibold text-neutral-900 leading-none">{{ handle ? handle.replace(/^@/, '') : 'Your Name' }} · <span class="font-normal text-muted">1st</span></p>
              <p class="text-[12px] text-neutral-600 line-clamp-1">Creator · Helping builders ship faster — 12k followers</p>
              <p class="text-[11px] text-muted flex items-center gap-1">2h · <Icon name="i-lucide-globe" class="w-3 h-3" /></p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton size="xs" color="primary" variant="outline" icon="i-lucide-plus" :label="t('preview.follow', 'Follow')" class="rounded-full" />
            <Icon name="i-lucide-ellipsis" class="w-4 h-4 text-neutral-600" />
          </div>
        </div>
        <p class="mt-3 text-[14px] leading-[1.45] text-neutral-800">
          {{ t('preview.liText', 'New carousel just dropped — swipe through and let me know which slide hits hardest.') }} <span class="text-[#0a66c2]">#carousel #design</span>
        </p>
      </div>

      <!-- Document / image carousel -->
      <div class="relative bg-[#f4f2ee] border-y border-neutral-200">
        <div class="bg-inverted">
          <CarouselStage :html="html" :width="width" :height="height" :guides="false" :fx-style="fxStyle" />
        </div>

        <!-- LinkedIn carousel chrome: page indicator + arrows -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center">
            <Icon name="i-lucide-chevron-left" class="w-4 h-4 text-neutral-700" />
          </div>
          <div class="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center">
            <Icon name="i-lucide-chevron-right" class="w-4 h-4 text-neutral-700" />
          </div>
        </div>
        <div class="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-1 rounded bg-black/70 text-highlighted">
          {{ currentIndex + 1 }} / {{ total }}
        </div>
      </div>

      <!-- LinkedIn footer -->
      <div class="bg-white px-2 py-1.5">
        <!-- dot pagination like LinkedIn document -->
        <div class="flex items-center justify-center gap-1.5 py-2" data-testid="li-dots">
          <span
            v-for="i in total"
            :key="i"
            class="h-1.5 rounded-full transition-all"
            :class="i - 1 === currentIndex ? 'w-6 bg-muted' : 'w-1.5 bg-neutral-300'"
          />
        </div>
        <div class="flex items-center justify-between border-t border-neutral-100 pt-2">
          <div class="flex items-center gap-1 text-[11px] text-neutral-600">
            <span class="flex -space-x-1">
              <span class="h-4 w-4 rounded-full bg-[#0a66c2] border border-white flex items-center justify-center text-[9px] text-highlighted">♥</span>
              <span class="h-4 w-4 rounded-full bg-green-600 border border-white flex items-center justify-center text-[9px] text-highlighted">👍</span>
              <span class="h-4 w-4 rounded-full bg-amber-500 border border-white flex items-center justify-center text-[9px] text-highlighted">💡</span>
            </span>
            <span>834</span>
            <span class="text-muted">·</span>
            <span>42 comments · 12 reposts</span>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1 mt-2 text-[12px] font-medium text-neutral-600">
          <button class="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-neutral-100"><Icon name="i-lucide-thumbs-up" class="w-4 h-4" /> {{ t('preview.like', 'Like') }}</button>
          <button class="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-neutral-100"><Icon name="i-lucide-message-square" class="w-4 h-4" /> {{ t('preview.comment', 'Comment') }}</button>
          <button class="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-neutral-100"><Icon name="i-lucide-repeat-2" class="w-4 h-4" /> {{ t('preview.repost', 'Repost') }}</button>
          <button class="flex items-center justify-center gap-1.5 py-2 rounded hover:bg-neutral-100"><Icon name="i-lucide-send" class="w-4 h-4" /> {{ t('preview.send', 'Send') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
