<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import {
  GRADIENT_PRESETS,
  SOLID_PRESETS,
  OG_TEMPLATES,
  OG_PLATFORMS,
  templateDef,
  backgroundCss,
  patternCss,
  patternSize,
  type OgPlatform,
  type PatternKind
} from '../composables/og-model'
import { useOgDoc } from '../composables/useOgDoc'
import OgScaledStage from './OgScaledStage.vue'
import OgDock from './OgDock.vue'
import OgMediaPicker from './OgMediaPicker.vue'

const props = defineProps<{
  platform: OgPlatform
}>()

const { t } = useI18n()
const doc = useOgDoc()
const config = computed(() => doc.value.templateConfig)

const leftDock = ref<string | null>(null)
const rightDock = ref<string | null>(null)

const leftItems = [
  { key: 'templates', icon: 'i-lucide-layout-template', label: t('templates') },
  { key: 'content', icon: 'i-lucide-type', label: t('content') },
  { key: 'background', icon: 'i-lucide-wallpaper', label: t('background') },
  { key: 'theme', icon: 'i-lucide-palette', label: t('theme') },
  { key: 'images', icon: 'i-lucide-image', label: t('images') }
]

const rightItems = [
  { key: 'size', icon: 'i-lucide-proportions', label: t('size') }
]

const currentDef = computed(() => templateDef(config.value.template))
const hasImageSlot = computed(() => currentDef.value.imageSlot)
const hasAvatarSlot = computed(() => currentDef.value.avatarSlot)

const openImages = () => {
  leftDock.value = 'images'
}

const u = (base: number) => base * (props.platform.width / 1200)

const fsTitle = computed(() => u(84) * (config.value.theme.fontScale / 100))
const fsSubtitle = computed(() => u(34) * (config.value.theme.fontScale / 100))
const fsTag = computed(() => u(24) * (config.value.theme.fontScale / 100))
const fsAuthor = computed(() => u(28) * (config.value.theme.fontScale / 100))

const stageStyle = computed(() => ({
  background: backgroundCss(config.value.background),
  color: config.value.theme.textColor
}))

const patternStyle = computed(() => {
  const image = patternCss(config.value.pattern)
  if (!image) return {}
  return { backgroundImage: image, backgroundSize: patternSize(config.value.pattern) || undefined }
})

const pillStyle = computed(() => ({
  borderColor: config.value.theme.accentColor,
  fontSize: `${fsTag.value}px`
}))

const accentStyle = computed(() => ({ backgroundColor: config.value.theme.accentColor }))
const avatarFallback = computed(() => config.value.fields.author.charAt(0).toUpperCase() || 'M')

const patterns: PatternKind[] = ['none', 'grid', 'dots', 'noise']
</script>

<template>
  <div class="relative">
    <OgScaledStage class="min-w-0" :width="platform.width" :height="platform.height">
      <div class="absolute inset-0" :style="stageStyle">
        <img
          v-if="config.background.kind === 'image' && config.background.imageUrl"
          :src="config.background.imageUrl"
          alt=""
          class="absolute inset-0 w-full h-full object-cover"
        >
        <div v-if="config.background.kind === 'image'" class="absolute inset-0" :style="{ opacity: config.background.overlayOpacity / 100, background: '#000000' }" />
        <div class="absolute inset-0" :style="patternStyle" />

        <!-- hero-left -->
        <div v-if="config.template === 'hero-left'" class="absolute inset-0 flex flex-col justify-between" :style="{ padding: `${u(64)}px` }">
          <div class="flex items-center gap-4">
            <img v-if="config.fields.logoUrl" :src="config.fields.logoUrl" alt="" class="object-contain" :style="{ height: `${u(48)}px` }">
            <span v-else class="font-extrabold tracking-tight" :style="{ fontSize: `${u(32)}px` }">{{ config.fields.logoText }}</span>
          </div>
          <div class="flex flex-col gap-6 max-w-[75%]">
            <span v-if="config.fields.tag" class="self-start border rounded-full px-5 py-1.5" :style="pillStyle">{{ config.fields.tag }}</span>
            <h1 class="font-bold leading-tight line-clamp-3" :style="{ fontSize: `${fsTitle}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
            <p class="opacity-80 line-clamp-2" :style="{ fontSize: `${fsSubtitle}px` }">{{ config.fields.subtitle }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="rounded-full overflow-hidden grid place-items-center font-bold" :style="{ width: `${u(56)}px`, height: `${u(56)}px`, backgroundColor: config.theme.accentColor, color: '#0a0a0a', fontSize: `${u(26)}px` }">
              <img v-if="config.fields.avatarUrl" :src="config.fields.avatarUrl" alt="" class="w-full h-full object-cover">
              <template v-else>{{ avatarFallback }}</template>
            </div>
            <span class="opacity-90" :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
          </div>
        </div>

        <!-- hero-center -->
        <div v-else-if="config.template === 'hero-center'" class="absolute inset-0 flex flex-col items-center justify-center text-center gap-7" :style="{ padding: `${u(72)}px` }">
          <div class="flex items-center gap-3">
            <span class="inline-block rounded-full" :style="{ ...accentStyle, width: `${u(14)}px`, height: `${u(14)}px` }" />
            <span class="font-extrabold tracking-tight uppercase" :style="{ fontSize: `${u(22)}px`, letterSpacing: '0.25em' }">{{ config.fields.logoText }}</span>
          </div>
          <h1 class="font-bold leading-tight line-clamp-3 max-w-[85%]" :style="{ fontSize: `${fsTitle * 1.05}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
          <p class="opacity-80 max-w-[65%]" :style="{ fontSize: `${fsSubtitle}px` }">{{ config.fields.subtitle }}</p>
          <span v-if="config.fields.tag" class="border rounded-full px-5 py-1.5" :style="pillStyle">{{ config.fields.tag }}</span>
        </div>

        <!-- article -->
        <div v-else-if="config.template === 'article'" class="absolute inset-0 flex" :style="{ padding: `${u(56)}px`, gap: `${u(40)}px` }">
          <div class="flex-1 flex flex-col justify-between min-w-0">
            <div class="flex flex-col gap-5">
              <span v-if="config.fields.tag" class="self-start border rounded-full px-4 py-1" :style="pillStyle">{{ config.fields.tag }}</span>
              <h1 class="font-bold leading-tight line-clamp-4" :style="{ fontSize: `${fsTitle * 0.82}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
              <p class="opacity-80 line-clamp-3" :style="{ fontSize: `${fsSubtitle * 0.85}px` }">{{ config.fields.subtitle }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-block rounded-full" :style="{ ...accentStyle, width: `${u(12)}px`, height: `${u(12)}px` }" />
              <span class="opacity-90" :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
            </div>
          </div>
          <div class="shrink-0 grid place-items-center rounded-2xl overflow-hidden" :style="{ width: `${u(420)}px` }">
            <img v-if="config.fields.imageUrl" :src="config.fields.imageUrl" alt="" class="w-full h-full object-cover">
            <button v-else type="button" class="w-full h-full grid place-items-center bg-white/5 border-2 border-dashed border-white/25 hover:border-white/50 transition-colors" @click="openImages">
              <span class="flex flex-col items-center gap-2 opacity-70">
                <Icon name="i-lucide-image-plus" :size="u(56)" />
                <span class="text-sm" :style="{ fontSize: `${u(20)}px` }">{{ t('add_image') }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- quote -->
        <div v-else-if="config.template === 'quote'" class="absolute inset-0 flex flex-col justify-center gap-8" :style="{ padding: `${u(88)}px` }">
          <span :style="{ fontSize: `${u(140)}px`, lineHeight: 0.6, color: config.theme.accentColor }">&ldquo;</span>
          <h1 class="font-bold leading-snug line-clamp-4" :style="{ fontSize: `${fsTitle * 0.9}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
          <div class="flex items-center justify-end gap-4">
            <div class="rounded-full overflow-hidden grid place-items-center font-bold" :style="{ width: `${u(52)}px`, height: `${u(52)}px`, backgroundColor: config.theme.accentColor, color: '#0a0a0a', fontSize: `${u(24)}px` }">
              <img v-if="config.fields.avatarUrl" :src="config.fields.avatarUrl" alt="" class="w-full h-full object-cover">
              <template v-else>{{ avatarFallback }}</template>
            </div>
            <span class="opacity-90" :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
          </div>
        </div>

        <!-- event -->
        <div v-else-if="config.template === 'event'" class="absolute inset-0 flex flex-col items-center justify-center text-center gap-6" :style="{ padding: `${u(72)}px` }">
          <span class="border rounded-full px-6 py-2 font-bold uppercase tracking-widest" :style="pillStyle">{{ config.fields.tag || t('event_tag_fallback') }}</span>
          <h1 class="font-bold leading-tight line-clamp-3 max-w-[90%]" :style="{ fontSize: `${fsTitle}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
          <p class="opacity-80 max-w-[60%]" :style="{ fontSize: `${fsSubtitle}px` }">{{ config.fields.subtitle }}</p>
          <div class="flex items-center gap-3 opacity-90">
            <Icon name="i-lucide-user" :size="u(26)" />
            <span :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
          </div>
        </div>

        <!-- promo -->
        <div v-else-if="config.template === 'promo'" class="absolute inset-0 flex">
          <div class="h-full flex flex-col items-start justify-between" :style="{ ...accentStyle, width: `${u(320)}px`, padding: `${u(48)}px` }">
            <span class="font-extrabold tracking-tight" :style="{ fontSize: `${u(34)}px`, color: '#0a0a0a' }">{{ config.fields.logoText }}</span>
            <span class="font-bold uppercase tracking-widest" :style="{ fontSize: `${u(20)}px`, color: 'rgba(0,0,0,.55)', writingMode: 'vertical-rl' }">{{ config.fields.tag }}</span>
          </div>
          <div class="flex-1 flex flex-col justify-center gap-6 min-w-0" :style="{ padding: `${u(64)}px` }">
            <h1 class="font-bold leading-tight line-clamp-4" :style="{ fontSize: `${fsTitle * 0.92}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
            <p class="opacity-80 line-clamp-3" :style="{ fontSize: `${fsSubtitle}px` }">{{ config.fields.subtitle }}</p>
            <span class="opacity-90" :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
          </div>
        </div>

        <!-- podcast -->
        <div v-else-if="config.template === 'podcast'" class="absolute inset-0 flex" :style="{ padding: `${u(56)}px`, gap: `${u(48)}px` }">
          <div class="shrink-0 rounded-2xl overflow-hidden grid place-items-center" :style="{ width: `${u(400)}px` }">
            <img v-if="config.fields.imageUrl" :src="config.fields.imageUrl" alt="" class="w-full h-full object-cover">
            <button v-else type="button" class="w-full h-full grid place-items-center bg-white/5 border-2 border-dashed border-white/25 hover:border-white/50" @click="openImages">
              <span class="flex flex-col items-center gap-2 opacity-70">
                <Icon name="i-lucide-mic" :size="u(56)" />
                <span :style="{ fontSize: `${u(20)}px` }">{{ t('add_cover') }}</span>
              </span>
            </button>
          </div>
          <div class="flex-1 flex flex-col justify-center gap-5 min-w-0">
            <span v-if="config.fields.tag" class="self-start border rounded-full px-4 py-1" :style="pillStyle">{{ config.fields.tag }}</span>
            <h1 class="font-bold leading-tight line-clamp-3" :style="{ fontSize: `${fsTitle * 0.78}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
            <p class="opacity-80 line-clamp-2" :style="{ fontSize: `${fsSubtitle * 0.85}px` }">{{ config.fields.subtitle }}</p>
            <div class="flex items-center gap-3 opacity-90">
              <Icon name="i-lucide-play" :size="u(24)" :style="{ color: config.theme.accentColor }" />
              <span :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
            </div>
          </div>
        </div>

        <!-- announcement -->
        <div v-else-if="config.template === 'announcement'" class="absolute inset-0 flex flex-col items-center justify-center text-center gap-7" :style="{ padding: `${u(80)}px` }">
          <span class="font-bold uppercase tracking-[0.3em] rounded-full px-6 py-2" :style="{ ...accentStyle, color: '#0a0a0a', fontSize: `${fsTag * 0.9}px` }">{{ config.fields.tag || t('new_label') }}</span>
          <h1 class="font-extrabold leading-tight line-clamp-3 max-w-[90%]" :style="{ fontSize: `${fsTitle * 1.1}px`, fontWeight: 800 }">{{ config.fields.title }}</h1>
          <p class="opacity-80 max-w-[60%]" :style="{ fontSize: `${fsSubtitle}px` }">{{ config.fields.subtitle }}</p>
          <span class="opacity-90" :style="{ fontSize: `${fsAuthor}px` }">{{ config.fields.author }}</span>
        </div>

        <!-- link-card -->
        <div v-else-if="config.template === 'link-card'" class="absolute inset-0 flex items-center justify-center" :style="{ padding: `${u(64)}px` }">
          <div class="w-full h-full rounded-2xl overflow-hidden ring-1 ring-white/15 bg-black/30 backdrop-blur-sm flex flex-col">
            <div class="flex items-center gap-2 px-5" :style="{ height: `${u(52)}px`, backgroundColor: 'rgba(255,255,255,.06)' }">
              <span class="rounded-full bg-red-400/80" :style="{ width: `${u(12)}px`, height: `${u(12)}px` }" />
              <span class="rounded-full bg-yellow-400/80" :style="{ width: `${u(12)}px`, height: `${u(12)}px` }" />
              <span class="rounded-full bg-green-400/80" :style="{ width: `${u(12)}px`, height: `${u(12)}px` }" />
              <span class="ml-4 opacity-70 truncate" :style="{ fontSize: `${u(18)}px` }">{{ config.fields.logoText }}</span>
            </div>
            <div class="flex-1 min-h-0 grid place-items-center">
              <img v-if="config.fields.imageUrl" :src="config.fields.imageUrl" alt="" class="w-full h-full object-cover">
              <button v-else type="button" class="w-full h-full grid place-items-center bg-white/5 border-2 border-dashed border-white/25 hover:border-white/50" @click="openImages">
                <span class="flex flex-col items-center gap-2 opacity-70">
                  <Icon name="i-lucide-link" :size="u(48)" />
                  <span :style="{ fontSize: `${u(20)}px` }">{{ t('add_preview_image') }}</span>
                </span>
              </button>
            </div>
            <div class="flex items-center justify-between gap-4" :style="{ padding: `${u(24)}px ${u(32)}px` }">
              <h1 class="font-bold leading-tight line-clamp-2 min-w-0" :style="{ fontSize: `${fsTitle * 0.5}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
              <span class="shrink-0 opacity-80" :style="{ fontSize: `${fsAuthor * 0.8}px` }">{{ config.fields.author }}</span>
            </div>
          </div>
        </div>

        <!-- profile -->
        <div v-else-if="config.template === 'profile'" class="absolute inset-0 flex flex-col items-center justify-center text-center gap-6" :style="{ padding: `${u(72)}px` }">
          <div class="rounded-full overflow-hidden grid place-items-center font-bold ring-4" :style="{ width: `${u(180)}px`, height: `${u(180)}px`, backgroundColor: config.theme.accentColor, color: '#0a0a0a', fontSize: `${u(72)}px`, borderColor: config.theme.accentColor }">
            <img v-if="config.fields.avatarUrl" :src="config.fields.avatarUrl" alt="" class="w-full h-full object-cover">
            <template v-else>{{ avatarFallback }}</template>
          </div>
          <h1 class="font-bold leading-tight line-clamp-2" :style="{ fontSize: `${fsTitle * 0.72}px`, fontWeight: config.theme.fontWeight }">{{ config.fields.title }}</h1>
          <p class="opacity-80 max-w-[60%]" :style="{ fontSize: `${fsSubtitle}px` }">{{ config.fields.subtitle }}</p>
          <span v-if="config.fields.tag" class="border rounded-full px-5 py-1.5" :style="pillStyle">{{ config.fields.tag }}</span>
        </div>
      </div>
    </OgScaledStage>

    <!-- Left floating dock -->
    <OgDock v-model:active="leftDock" side="left" :items="leftItems">
      <template #templates>
        <p class="text-sm font-semibold">{{ t('templates') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="tpl in OG_TEMPLATES"
            :key="tpl.key"
            type="button"
            class="rounded-lg border p-1.5 transition-colors"
            :class="config.template === tpl.key ? 'border-primary ring-2 ring-primary/40' : 'border-default hover:border-accented'"
            @click="() => { config.template = tpl.key }"
          >
            <div class="h-12 rounded bg-neutral-800 relative overflow-hidden flex items-end p-1.5">
              <div v-if="tpl.key === 'promo'" class="absolute inset-y-0 left-0 w-1/3" :style="accentStyle" />
              <div v-if="tpl.key === 'link-card'" class="absolute inset-x-2 top-1 h-2 rounded-sm bg-neutral-600" />
              <div v-if="tpl.imageSlot" class="absolute right-1 top-1 rounded-sm bg-neutral-600 w-1/3 h-1/2" />
              <div v-if="tpl.key === 'profile'" class="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full bg-neutral-500 w-5 h-5" />
              <div class="w-full space-y-1 relative">
                <div class="h-1.5 rounded-full bg-neutral-400" :class="['hero-center', 'announcement', 'profile'].includes(tpl.key) ? 'w-3/5 mx-auto' : 'w-3/5'" />
                <div class="h-1 rounded-full bg-neutral-600 w-2/5" :class="['hero-center', 'announcement', 'profile'].includes(tpl.key) ? 'mx-auto' : ''" />
              </div>
            </div>
            <p class="mt-1 text-center text-xs text-muted flex items-center justify-center gap-1">
              {{ t(`tpl_${tpl.key.replace('-', '_')}`) }}
              <Icon v-if="tpl.imageSlot" name="i-lucide-image" class="opacity-50" size="10" />
            </p>
          </button>
        </div>
      </template>

      <template #content>
        <p class="text-sm font-semibold">{{ t('content') }}</p>
        <UFormField :label="t('field_title')">
          <UTextarea v-model="config.fields.title" autoresize :rows="2" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('tag')">
            <UInput v-model="config.fields.tag" class="w-full" />
          </UFormField>
          <UFormField :label="t('author')">
            <UInput v-model="config.fields.author" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('field_subtitle')">
          <UTextarea v-model="config.fields.subtitle" autoresize :rows="2" class="w-full" />
        </UFormField>
        <UFormField :label="t('logo_text')">
          <UInput v-model="config.fields.logoText" class="w-full" />
        </UFormField>
      </template>

      <template #background>
        <p class="text-sm font-semibold">{{ t('background') }}</p>
        <UTabs
          v-model="config.background.kind"
          :items="[{ label: t('gradient'), value: 'gradient' }, { label: t('solid'), value: 'solid' }, { label: t('image'), value: 'image' }]"
          color="neutral"
          size="sm"
        />
        <div v-if="config.background.kind === 'gradient'" class="space-y-2">
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="g in GRADIENT_PRESETS"
              :key="g.name"
              type="button"
              class="h-9 rounded-md ring-1 ring-white/10 hover:ring-primary"
              :style="{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }"
              :title="g.name"
              @click="() => { config.background.gradientFrom = g.from; config.background.gradientTo = g.to }"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('from')" size="xs">
              <UColorPicker v-model="config.background.gradientFrom" class="w-full" size="sm" />
            </UFormField>
            <UFormField :label="t('to')" size="xs">
              <UColorPicker v-model="config.background.gradientTo" class="w-full" size="sm" />
            </UFormField>
          </div>
        </div>
        <div v-else-if="config.background.kind === 'solid'" class="space-y-2">
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="c in SOLID_PRESETS"
              :key="c"
              type="button"
              class="h-9 rounded-md ring-1 ring-white/10"
              :style="{ background: c }"
              @click="() => { config.background.solidColor = c }"
            />
          </div>
          <UColorPicker v-model="config.background.solidColor" class="w-full" size="sm" />
        </div>
        <div v-else>
          <OgMediaPicker v-model="config.background.imageUrl" :label="t('background_image')" />
          <UFormField :label="t('overlay_opacity')" size="xs" class="mt-3">
            <USlider v-model="config.background.overlayOpacity" :min="0" :max="100" />
          </UFormField>
        </div>
        <UFormField :label="t('pattern_overlay')" size="xs">
          <URadioGroup
            v-model="config.pattern"
            orientation="horizontal"
            variant="card"
            size="xs"
            :items="(patterns as PatternKind[]).map(p => ({ label: p, value: p }))"
          />
        </UFormField>
      </template>

      <template #theme>
        <p class="text-sm font-semibold">{{ t('theme') }}</p>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('text_color')" size="xs">
            <UColorPicker v-model="config.theme.textColor" class="w-full" size="sm" />
          </UFormField>
          <UFormField :label="t('accent_color')" size="xs">
            <UColorPicker v-model="config.theme.accentColor" class="w-full" size="sm" />
          </UFormField>
        </div>
        <UFormField :label="t('font_scale')" size="xs">
          <USlider v-model="config.theme.fontScale" :min="60" :max="140" />
          <p class="text-xs text-muted mt-1">{{ config.theme.fontScale }}%</p>
        </UFormField>
      </template>

      <template #images>
        <p class="text-sm font-semibold">{{ t('images') }}</p>
        <OgMediaPicker v-if="hasImageSlot" v-model="config.fields.imageUrl" :label="t('main_image')" />
        <OgMediaPicker v-if="hasAvatarSlot" v-model="config.fields.avatarUrl" :label="t('avatar')" />
        <p v-if="!hasImageSlot && !hasAvatarSlot" class="text-xs text-muted py-4 text-center">
          {{ t('no_image_slots', { template: t(`tpl_${config.template.replace('-', '_')}`) }) }}
        </p>
      </template>
    </OgDock>

    <!-- Right floating dock -->
    <OgDock v-model:active="rightDock" side="right" :items="rightItems">
      <template #size>
        <p class="text-sm font-semibold">{{ t('size') }}</p>
        <div class="space-y-1">
          <button
            v-for="p in OG_PLATFORMS"
            :key="p.key"
            type="button"
            class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors"
            :class="doc.platform === p.key ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accented/60'"
            @click="() => { doc.platform = p.key }"
          >
            <span>{{ p.label }}</span>
            <span class="text-xs text-muted">{{ p.width }}×{{ p.height }}</span>
          </button>
        </div>
      </template>
    </OgDock>
  </div>
</template>
