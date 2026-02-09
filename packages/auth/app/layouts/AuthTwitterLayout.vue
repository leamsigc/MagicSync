<script lang="ts" setup>
import TwitterRightSideBar from './dashboard/TwitterRightSideBar.vue';
import TwitterSideBar from './dashboard/TwitterSideBar.vue';

/**
 *
 * Twitter Layout for Auth
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
</script>

<template>
  <BaseTwitterLayout size="lg">
    <template #left-sidebar>
      <TwitterSideBar />
    </template>
    <slot />
    <template #right-sidebar>
      <TwitterRightSideBar />
    </template>
  </BaseTwitterLayout>
</template>
<style scoped></style>
