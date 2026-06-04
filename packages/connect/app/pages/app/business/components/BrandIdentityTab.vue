<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import { inject } from 'vue'
import { BusinessFormProviderKey } from '../composables/useBusinessFormProvider'

const { state, actions } = inject(BusinessFormProviderKey)!;

const { t } = useI18n()

const updateBrandDetails = (value: string) => {
  actions.updateBrandDetails(value)
}
</script>

<template>
  <div class="space-y-6 min-h-[500px] grid grid-cols-1 content-center">
    <!-- Info Banner -->
    <div class="p-4  rounded-lg flex gap-3 text-sm text-gray-600 dark:text-gray-300">
      <UIcon name="lucide:paint-bucket" class="w-5 h-5 shrink-0 text-gray-500" />
      <p>{{ t('brand_identity.description') }}</p>
    </div>

    <!-- Brand Identity Textarea -->
    <UFormField :label="t('brand_identity.label')" name="brandDetails" class="w-full">
      <UTextarea v-model="state.brandDetails" placeholder="{}" :rows="16"
        class="font-mono text-xs md:text-sm tracking-tight shadow-inner  py-4 w-full" autoresize />
    </UFormField>
  </div>
</template>
