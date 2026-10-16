<i18n src="./playbook.json"></i18n>
<script lang="ts" setup>
import BusinessPlaybook from '#layers/BaseConnect/app/components/connect/business/components/BusinessPlaybook.vue'
import BusinessWorkspaceTabs from '#layers/BaseConnect/app/components/connect/business/components/BusinessWorkspaceTabs.vue'

const { t } = useI18n()
const route = useRoute()

const businessId = route.params.id as string

useHead({
  title: t('seo_title'),
  meta: [
    { name: 'description', content: t('seo_description') }
  ]
})
</script>

<template>
  <div class="mx-auto w-full max-w-[100rem] px-4 py-4 lg:px-8">
    <BusinessWorkspaceTabs :business-id="businessId" active="playbook" />
    <BusinessPlaybook :business-id="businessId" />
  </div>
</template>

<style scoped></style>
