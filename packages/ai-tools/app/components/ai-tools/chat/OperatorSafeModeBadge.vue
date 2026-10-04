<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { useOperatorSafeMode } from '../../../composables/ai-tools/chat/useOperatorConsole'

const props = defineProps<{
  businessId?: string | null
}>()

const { t } = useI18n()
const { load, safeMode, switching, toggle } = useOperatorSafeMode(() => props.businessId ?? undefined)

onMounted(() => {
  void load()
})

watch(() => props.businessId, () => {
  void load()
})
</script>

<template>
  <UButton
    :color="safeMode ? 'success' : 'warning'"
    variant="soft"
    size="sm"
    class="rounded-full"
    :icon="safeMode ? 'i-heroicons-shield-check' : 'i-heroicons-shield-exclamation'"
    :label="safeMode ? t('operator.safeModeOn') : t('operator.safeModeOff')"
    :loading="switching"
    :disabled="!businessId"
    :aria-label="t('operator.safeModeSwitch')"
    data-testid="operator-safe-mode"
    @click="toggle"
  />
</template>
