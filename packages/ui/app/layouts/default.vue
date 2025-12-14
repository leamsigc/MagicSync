<script lang="ts" setup>

/**
 *
 * Default layout for the application
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
  <main class="default relative">
    <BaseHeader />
    <div class="p-4 md:p-0">
      <slot />
    </div>

    <LazyBaseFooter />
  </main>
</template>

<style scoped></style>
