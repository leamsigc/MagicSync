<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
/**
 * Platform chips for a content card.
 *
 * Options come from the shared `CONTENT_PLATFORMS` catalog, so the board, the
 * idea scan and the publish configs cannot disagree about what is supported.
 */
import { CONTENT_PLATFORMS } from '#layers/BaseShared/shared/platformConstants'
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons'

const props = withDefaults(defineProps<{
  modelValue: string[]
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { t } = useI18n()
const { getPlatformIcon } = usePlatformIcons()

function isSelected(name: string): boolean {
  return props.modelValue.includes(name)
}

function toggle(name: string) {
  const next = isSelected(name)
    ? props.modelValue.filter(platform => platform !== name)
    : [...props.modelValue, name]
  emit('update:modelValue', next)
}

function clear() {
  emit('update:modelValue', [])
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-1.5">
      <UButton
        v-for="platform in CONTENT_PLATFORMS"
        :key="platform.name"
        size="xs"
        :variant="isSelected(platform.name) ? 'solid' : 'outline'"
        :color="isSelected(platform.name) ? 'primary' : 'neutral'"
        :icon="getPlatformIcon(platform.name as SocialMediaPlatform)"
        :label="platform.display_name"
        :disabled="props.disabled"
        :aria-pressed="isSelected(platform.name)"
        :trailing-icon="isSelected(platform.name) ? 'i-lucide-check' : undefined"
        :data-testid="`card-platform-${platform.name}`"
        @click="() => toggle(platform.name)"
      />
    </div>

    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-muted">
        {{ props.modelValue.length ? t('card.platformsSelected', { count: props.modelValue.length }) : t('card.platformsEmpty') }}
      </p>
      <UButton
        v-if="props.modelValue.length > 0"
        size="xs"
        variant="ghost"
        color="neutral"
        :label="t('card.platformsClear')"
        :disabled="props.disabled"
        @click="clear"
      />
    </div>
  </div>
</template>
