<i18n src="#site/app/pages/tools/menu-board/index.json"></i18n>
<script setup lang="ts">
/**
 *
 * BoardSettingsModal — transition time + unlock PIN for the board display.
 *
 */
import { TV_DISPLAY_SIZES, type MenuBoardSettings } from '../../../utils/tools/menu-board/types'

const { t } = useI18n()

const props = defineProps<{ settings: MenuBoardSettings }>()
const emit = defineEmits<{
  'update:settings': [settings: Partial<MenuBoardSettings>]
  close: []
}>()

const open = defineModel<boolean>('open', { default: false })

const draft = ref<MenuBoardSettings>({ ...props.settings })
watch(() => props.settings, s => (draft.value = { ...s }), { deep: true, immediate: true })

function save(): void {
  emit('update:settings', {
    transitionTime: Math.max(1, Number(draft.value.transitionTime) || 10),
    unlockPin: draft.value.unlockPin,
    displaySize: draft.value.displaySize,
  })
  emit('close')
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-md' }">
    <template #content>
      <div class="p-6 space-y-6" data-testid="board-settings-modal">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold tracking-tight">{{ t('display_settings') }}</h2>
          <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { open = false }" />
        </div>

        <UFormField
:label="t('transition_time')"
          :description="t('transition_time_desc')">
          <UInput
v-model.number="draft.transitionTime" type="number" :min="1" :max="3600" class="w-full"
            data-testid="settings-transition-time" />
        </UFormField>

        <UFormField
:label="t('display_size')"
          :description="t('display_size_desc')">
          <USelect
            v-model="draft.displaySize" :items="TV_DISPLAY_SIZES.map(s => ({ label: s.label, value: s.key }))"
            class="w-full" data-testid="settings-display-size" />
        </UFormField>

        <UFormField
:label="t('unlock_pin')"
          :description="t('unlock_pin_desc')">
          <UInput
v-model="draft.unlockPin" class="w-full" placeholder="e.g. 1234"
            data-testid="settings-unlock-pin" />
        </UFormField>

        <div class="flex justify-end">
          <UButton data-testid="settings-save" @click="save">{{ t('save_settings') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
