<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import { inject } from 'vue'
import { BusinessFormProviderKey } from '../composables/useBusinessFormProvider'

const { state, actions } = inject(BusinessFormProviderKey)!;

const { t } = useI18n()

const updateCompanyInformation = (value: string) => {
  actions.updateCompanyInformation(value)
}
</script>

<template>
  <div class="space-y-6 min-h-[500px] grid grid-cols-1 content-start">
    <!-- Info Banner -->
    <div class="p-4  rounded-lg   flex gap-3 text-sm text-gray-600 dark:text-gray-300">
      <UIcon name="lucide:info" class="w-5 h-5 shrink-0 text-gray-500" />
      <p>{{ t('company_info.description') }}</p>
    </div>

    <!-- Company Information Editor -->
    <UFormField :label="t('company_info.label')" name="companyInformation">
      <UEditor v-model="state.companyInformation" content-type="markdown" :placeholder="t('company_info.placeholder')"
        :rows="16" class="font-mono text-xs md:text-sm shadow-inner  rounded-md py-12" />
    </UFormField>
  </div>
</template>
