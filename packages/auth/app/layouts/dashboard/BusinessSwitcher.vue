<i18n src="./Menu.json"></i18n>
<script lang="ts" setup>
import { useBusinessManager } from '#layers/BaseConnect/app/pages/app/business/composables/useBusinessManager'

const { t } = useI18n()
const toast = useToast()

const { businesses, activeBusinessId, getAllBusinesses, setActiveBusiness } = useBusinessManager()
const switchingId = ref<string | null>(null)

const activeBusinessName = computed(() => businesses.value.data.find(b => b.id === activeBusinessId.value)?.name ?? t('menu.switchBusiness'))

const menuItems = computed(() => [
  { label: t('menu.switchBusiness'), icon: 'i-lucide-building-2', disabled: true },
  ...businesses.value.data.map(b => ({
    label: b.name,
    icon: b.id === activeBusinessId.value ? 'i-lucide-check' : 'i-lucide-building-2',
    onSelect: () => handleSelectBusiness(b.id),
  })),
  { type: 'separator' as const },
  { label: t('menu.allBusinesses'), icon: 'i-lucide-list', to: '/app/business' },
])

async function handleSelectBusiness(id: string) {
  if (id === activeBusinessId.value) return
  switchingId.value = id
  try {
    await setActiveBusiness(id)
    toast.add({ title: t('menu.switched'), description: businesses.value.data.find(b => b.id === id)?.name ?? id, icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('menu.switchFailed'), description: err instanceof Error ? err.message : undefined, icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    switchingId.value = null
  }
}

onMounted(() => {
  if (businesses.value.data.length === 0) void getAllBusinesses()
})
</script>

<template>
  <UDropdownMenu :items="menuItems" :ui="{ content: 'w-56 bg-elevated rounded-xl' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-building-2"
      :label="activeBusinessName"
      :loading="switchingId !== null"
      :aria-label="t('menu.switchBusiness')"
      class="max-w-48"
    />
  </UDropdownMenu>
</template>

<style scoped></style>
