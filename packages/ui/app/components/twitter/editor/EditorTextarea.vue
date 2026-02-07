<script lang="ts" setup>
/**
 * Component Description: Textarea for the Tweet Editor
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const modelValue = defineModel<string>('modelValue');
const placeholder = ref("What is happening?!");

</script>

<template>
  <UTextarea v-model="modelValue" :placeholder="placeholder" :rows="3" color="neutral" variant="none" autoresize
    class="w-full bg-transparent text-xl placeholder-gray-500 dark:placeholder-gray-400 border-none focus:ring-0 p-0 resize-none min-h-[100px]" />
</template>

<style scoped>
/* Remove default focus ring if UTextarea applies one via wrapper */
:deep(textarea:focus) {
  box-shadow: none !important;
}
</style>
