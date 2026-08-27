<i18n src="./index.json"></i18n>
<script lang="ts" setup>
const { t } = useI18n()
import TextBehindImage from './components/TextBehindImage.vue';
/**
 *
 * Image Background Remover
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

useHead({
  title: t('title'),
  meta: [
    {
      name: 'description',
      content: t('description'),
    },
  ],
});
useSeoMeta({
  title: t('title'),
  description: 'Best text over image tool for free!',
});
defineOgImage('BlogOgImage', {
  title: t('title'),
  description: t('description'),
  headline: '👋 Human Ideas...!',
});
</script>

<template>
  <ClientOnly>
    <div class="min-h-screen flex items-center justify-center">
      <TextBehindImage />
    </div>
  </ClientOnly>
</template>
<style scoped></style>
