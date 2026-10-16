<script setup lang="ts">
// Publishing moved into the workspace hub (Publishing tab).
const route = useRoute()
await navigateTo(`/app/business/${route.params.id}/content/publishing`, { replace: true })
</script>

<template>
  <div />
</template>
