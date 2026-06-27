<!--  Translation file -->
<i18n src="./business.json"></i18n>
<script lang="ts" setup>

const { t } = useI18n()

useHead({
  title: t('seo_title_initial'),
  meta: [
    { name: 'description', content: t('seo_description_initial') }
  ]
});

</script>

<template>
  <div>
    <BasePageHeader :title="t('title_initial')" :description="t('description_initial')" />
    <BusinessInitial/>
  </div>
</template>
<style scoped></style>
