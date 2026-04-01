<script lang="ts" setup>
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
  title: 'Text behind image for free',
  meta: [
    {
      name: 'description',
      content: 'Best text over image tool for free!',
    },
  ],
});
useSeoMeta({
  title: 'Text behind image for free',
  description: 'Best text over image tool for free!',
});
defineOgImage('BlogOgImage', {
  title: `${'Text behind image for free '.slice(0, 50)}...`,
  description: `${'Best text over image tool for free!'.slice(0, 200)}...`,
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
