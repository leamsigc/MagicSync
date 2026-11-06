<i18n src="./playbook.json"></i18n>
<script lang="ts" setup>
import BusinessPlaybook from '#layers/BaseConnect/app/components/connect/business/components/BusinessPlaybook.vue'
import BusinessWorkspaceTabs from '#layers/BaseConnect/app/components/connect/business/components/BusinessWorkspaceTabs.vue'
import { useBusinessAccess } from '#layers/BaseShared/app/composables/useBusinessAccess'

const { t } = useI18n()
const route = useRoute()

const businessId = route.params.id as string
const { isOwner, load: loadAccess } = useBusinessAccess(businessId)
onMounted(() => { void loadAccess() })

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
    <BusinessPlaybook :business-id="businessId" :readonly="!isOwner" />
  </div>
</template>

<style scoped></style>
