<i18n src="../business.json"></i18n>
<script lang="ts" setup>
import AddBusinessModal from './AddBusinessModal.vue'

const emit = defineEmits(['add', 'cancel'])
const modalOpen = defineModel<boolean>('open')
const initialSetup = defineModel<boolean>('initialSetup', { default: false })
</script>

<template>
  <AddBusinessModal v-model:open="modalOpen" v-model:initial-setup="initialSetup" @add="emit('add')" @cancel="emit('cancel')" />
</template>
