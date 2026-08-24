<script setup lang="ts">
/**
 *
 * BoardSettingsModal — transition time + unlock PIN for the board display.
 *
 */
import type { MenuBoardSettings } from '../types'

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
          <h2 class="text-xl font-semibold tracking-tight">Display Settings</h2>
          <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { open = false }" />
        </div>

        <UFormField
label="Transition Time (seconds)"
          description="How long each page is displayed before switching to the next.">
          <UInput
v-model.number="draft.transitionTime" type="number" :min="1" :max="3600" class="w-full"
            data-testid="settings-transition-time" />
        </UFormField>

        <UFormField
label="Unlock PIN"
          description="Required to exit display mode when locked. Keep this safe!">
          <UInput
v-model="draft.unlockPin" class="w-full" placeholder="e.g. 1234"
            data-testid="settings-unlock-pin" />
        </UFormField>

        <div class="flex justify-end">
          <UButton data-testid="settings-save" @click="save">Save Settings</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
