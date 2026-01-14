<!--  Translation file -->
<i18n src="../ImageEditor.json"></i18n>

<script lang="ts" setup>
import { ref } from 'vue';
import { useFabricJs } from '../composables/useFabricJs';
import ToolsImageTemplate from './ToolsImageTemplate.vue';

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
const { newEditor, downloadCanvasImage, exportCurrentCanvas } = useFabricJs();
const { t } = useI18n();
const isOpen = ref(false);
const menu = [
  {
    icon: 'lucide:plus',
    translationKey: 'menu.main.new',
    action: () => { },
  },
  {
    icon: 'lucide:folder',
    translationKey: 'menu.main.save',
    action: () => {
      downloadCanvasImage();
    },
  },
  {
    icon: 'lucide:download',
    translationKey: 'menu.main.export',
    action: () => exportCurrentCanvas(),
  },
  {
    icon: 'lucide:circle-arrow-left',
    action: () => { },
  },
  {
    icon: 'lucide:circle-arrow-right',
    action: () => { },
  },
  {
    icon: 'lucide:layout-template',
    translationKey: 'menu.main.templates',
    action: () => {
      isOpen.value = !isOpen.value;
    },
  },
];
</script>

<template>
  <!-- Top Menu  -->
  <header class="fixed top-10 left-6 z-40 backdrop-blur-md bg-black rounded-2xl shadow-2xl">
    <section class="flex items-center px-4 py-3 gap-4">
      <section class="flex items-center gap-2 ">
        <NuxtLink to="/">
          <UButton variant="link">Magic Social</UButton>
        </NuxtLink>
        <template v-for="(item, index) in menu" :key="`${item.icon}-${index}`">
          <UModal v-if="item.translationKey === 'menu.main.templates'" v-model:open="isOpen">
            <UButton :label="t('menu.main.templates')" color="neutral" size="sm" variant="link" />

            <template #content>
              <ToolsImageTemplate />
            </template>
          </UModal>
          <UButton size="sm" color="neutral" variant="link" @click="item.action" v-else>
            <Icon :name="item.icon" class="w-5 h-5" />
            <span v-if="item.translationKey">{{ t(item.translationKey) }}</span>
          </UButton>
        </template>
      </section>
    </section>
  </header>
</template>
<style scoped></style>
