<script setup lang="ts">
// The corpus editor moved into the workspace hub (Brand Base tab).
const route = useRoute()
await navigateTo(`/app/business/${route.params.id}/content/corpus`, { replace: true })
</script>

<template>
  <div />
</template>
