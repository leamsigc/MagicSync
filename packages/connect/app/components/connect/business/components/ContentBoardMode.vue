<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
/**
 * The board's mode line (PRD-CONTENT-PIPELINE-OVERHAUL §1.1): which of the two
 * modes the business runs in, one line saying what that mode does, and the one
 * control that changes it. This replaces the old standalone Safe Mode banner.
 */

defineProps<{
  safeMode: boolean
  busy: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

const { t } = useI18n()

function handleToggle() {
  emit('toggle')
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3" data-testid="board-mode">
    <div class="min-w-0">
      <p class="text-sm font-semibold text-highlighted">
        {{ safeMode ? t('board.mode.safe') : t('board.mode.autonomous') }}
      </p>
      <p class="text-xs text-muted">
        {{ safeMode ? t('board.mode.safeHint') : t('board.mode.autonomousHint') }}
      </p>
    </div>
    <UButton
      size="sm"
      variant="outline"
      color="neutral"
      :icon="safeMode ? 'i-heroicons-shield-check' : 'i-heroicons-bolt'"
      :loading="busy"
      :label="safeMode ? t('board.mode.switchToAutonomous') : t('board.mode.switchToSafe')"
      data-testid="board-mode-switch"
      @click="handleToggle"
    />
  </div>
</template>