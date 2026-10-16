<script setup lang="ts">
// The business editor moved into the workspace hub (Edit tab).
const route = useRoute()
await navigateTo(`/app/business/${route.params.id}/content/edit`, { replace: true })
</script>

<template>
  <div />
</template>
