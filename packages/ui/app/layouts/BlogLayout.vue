<script lang="ts" setup>

/**
 *
 * Component Description:Desc
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
  <main class="blog">
    <BaseHeader />
    <section class="mx-auto  prose pt-6 text-sm md:text-xl dark:prose-invert prose-pre:bg-transparent blog">
      <slot />
    </section>
    <LazyBaseBannerPromo />
    <LazyBaseFooter />
  </main>
</template>
<style scoped></style>
