<script lang="ts" setup>
</script>

<template>
  <main class="default relative min-h-screen">
    <BaseHeader />
    <div class="mx-auto pt-6 pb-12">
      <slot />
    </div>
    <LazyBaseFooter />
  </main>
</template>

<style scoped></style>
