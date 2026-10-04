<i18n src="./playbook.json"></i18n>
<script lang="ts" setup>
import BusinessPlaybook from '#layers/BaseConnect/app/components/connect/business/components/BusinessPlaybook.vue'

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
  <BusinessPlaybook :business-id="businessId" />
</template>

<style scoped></style>
