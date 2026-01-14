<!--  Translation file -->
<i18n src="../ImageEditor.json"></i18n>

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
import type { TabsItem } from '@nuxt/ui';
import RightMenuAiItems from './RightMenuAiItems.vue';
import RightMenuTools from './RightMenuTools.vue';
import RightMenuLayers from './RightMenuLayers.vue';
import RightMenuAdjust from './RightMenuAdjust.vue';
import RightMenuFilter from './RightMenuFilter.vue';

const { t } = useI18n();

// Right menu Ai,Tools,Layers,adjust,Filter
const items: TabsItem[] = [
  {
    icon: 'lucide:sparkles',
    label: t('menu.rightMenu.ai'),
    slot: 'ai',
  },
  {
    icon: 'lucide:drill',
    label: t('menu.rightMenu.tools'),
    slot: 'tools',
  },
  {
    icon: 'lucide:layers',
    label: t('menu.rightMenu.layers'),
    slot: 'layers',
  },
  {
    icon: 'lucide:settings-2',
    label: t('menu.rightMenu.adjust'),
    slot: 'adjust',
  },
  {
    icon: 'lucide:filter',
    label: t('menu.rightMenu.filter'),
    slot: 'filter',
  },
];
const isCollapsed = ref(false);

</script>

<template>
  <!-- Right Menu -->
  <header class="fixed top-40 right-6 z-40 backdrop-blur-md bg-black rounded-2xl shadow-2xl flex flex-col">
    <header class="flex items-center justify-between px-4 py-3 gap-4 border-background-foreground/10  max-w-md">
      <h3 class="text-lg font-semibold" v-if="!isCollapsed">
        Extra actions
      </h3>
      <UButton variant="ghost" @click="isCollapsed = !isCollapsed">
        <Icon name="lucide:x" v-if="!isCollapsed" />
        <Icon name="lucide:menu" v-else />
      </UButton>
    </header>
    <section class="max-w-md" v-if="!isCollapsed">
      <UTabs color="neutral" variant="link" default-value="ai" :items="items" class="w-full">
        <template #ai>
          <RightMenuAiItems />
        </template>
        <template #tools>
          <RightMenuTools />
        </template>
        <template #layers>
          <RightMenuLayers />
        </template>
        <template #adjust>
          <RightMenuAdjust />
        </template>
        <template #filter>
          <RightMenuFilter />
        </template>
      </UTabs>
    </section>
  </header>

</template>
<style scoped></style>
