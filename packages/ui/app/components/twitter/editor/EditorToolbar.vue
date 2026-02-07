<script lang="ts" setup>
/**
 * Component Description: Toolbar for the Tweet Editor
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const emit = defineEmits(['media', 'gif', 'poll', 'emoji', 'schedule']);
</script>

<template>
  <div class="flex items-center gap-1 text-primary">
    <UButton icon="i-heroicons-photo" color="primary" variant="ghost" @click="emit('media')" />
    <UButton icon="i-heroicons-gif" color="primary" variant="ghost" @click="emit('gif')" />
    <UButton icon="i-heroicons-list-bullet" color="primary" variant="ghost" @click="emit('poll')" />
    <UButton icon="i-heroicons-face-smile" color="primary" variant="ghost" @click="emit('emoji')" />
    <UButton icon="i-heroicons-calendar" color="primary" variant="ghost" @click="emit('schedule')" />
    <UButton icon="i-heroicons-map-pin" color="primary" variant="ghost" disabled />
  </div>
</template>
