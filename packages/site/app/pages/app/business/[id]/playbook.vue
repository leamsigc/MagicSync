<script setup lang="ts">
// The playbook moved into the workspace hub (Playbook tab).
const route = useRoute()
await navigateTo(`/app/business/${route.params.id}/content/playbook`, { replace: true })
</script>

<template>
  <div />
</template>
