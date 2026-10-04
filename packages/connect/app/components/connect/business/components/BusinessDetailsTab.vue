<i18n src="#site/app/pages/app/business/business.json"></i18n>
<script lang="ts" setup>
import { inject } from 'vue'
import { BusinessFormProviderKey } from '../../../../composables/connect/business/useBusinessFormProvider'

const { state, actions } = inject(BusinessFormProviderKey)!;

const { t } = useI18n()

const updateBusinessDetails = (field: string, value: any) => {
  const updates: any = {}
  updates[field] = value
  actions.updateBusinessDetails(updates)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Basic Information -->
    <div class="grid grid-cols-1  md:grid-cols-2 gap-6">
      <UFormField :label="t('form.description') || 'Description'" name="description" class="col-span-2">
        <UTextarea v-model="state.businessDetails.description"
          :placeholder="t('placeholders.description') || 'Brief description of the business'" :rows="10" autoresize
          size="lg" class="w-full" />
      </UFormField>
      <UFormField :label="t('form.name') || 'Business Name'" name="name">
        <UInput v-model="state.businessDetails.name" :placeholder="t('placeholders.name') || 'Acme Corp'" size="lg"
          class="w-full" icon="lucide:building-2" />
      </UFormField>



      <!-- Contact Information -->
      <UFormField :label="t('form.phone') || 'Phone'" name="phone">
        <UInput v-model="state.businessDetails.phone" :placeholder="t('placeholders.phone') || '+1 234 567 8900'"
          icon="lucide:phone" size="md" class="w-full" />
      </UFormField>

      <!-- Address -->
      <UFormField :label="t('form.address') || 'Address'" name="address">
        <UInput v-model="state.businessDetails.address"
          :placeholder="t('placeholders.address') || '123 Main St, City, Country'" icon="lucide:map-pin" size="md"
          class="w-full" />
      </UFormField>

      <!-- Website and Category -->
      <UFormField :label="t('form.website') || 'Website'" name="website">
        <UInput v-model="state.businessDetails.website"
          :placeholder="t('placeholders.website') || 'https://example.com'" icon="lucide:globe" size="md"
          class="w-full" />
      </UFormField>

      <UFormField :label="t('form.category') || 'Category'" name="category">
        <UInput v-model="state.businessDetails.category"
          :placeholder="t('placeholders.category') || 'Software, Retail, etc.'" icon="lucide:tag" size="md"
          class="w-full" />
      </UFormField>
    </div>
  </div>
</template>
