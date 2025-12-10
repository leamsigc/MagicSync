<!--  Translation file -->
<i18n src="../ImageEditor.json"></i18n>
<script lang="ts" setup>
import { useFabricJs } from '../composables/useFabricJs';

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
const { t } = useI18n();
const {
  selectLayer,
  cropLayer,
  addBrushLayer,
  addTextLayer,
  eraseLayer,
  updateFrameSettings,
  undo,
  redo,
  clearCanvas,
  zoomIn,
  zoomOut, // For "New" action
  editor,
  updateFrameSettingsToImageDimension
} = useFabricJs();

import type { DropdownMenuItem } from '@nuxt/ui'

// Menu items for the vertical menu in Nuxt UI v4 format
const menuItems = computed<DropdownMenuItem[]>(() => [
  {
    label: t('menu.vertical.select'),
    icon: 'lucide:pointer',
    onSelect: () => selectLayer(),
  },
  {
    label: t('menu.vertical.crop.crop'),
    icon: 'lucide:crop',
    children: [
      [
        {
          label: t('menu.vertical.crop.custom'),
          icon: 'lucide:crop',
          onSelect: () => cropLayer(),
        },
        {
          label: t('menu.vertical.crop.square'),
          icon: 'lucide:square',
          onSelect: () => cropLayer(), // Placeholder, actual square crop logic needed in useFabricJs
        },
      ],
    ],
  },
  {
    label: t('menu.vertical.draw'),
    icon: 'lucide:pen',
    onSelect: () => addBrushLayer(),
  },
  {
    label: t('menu.vertical.text.text'),
    icon: 'lucide:heading',
    children: [
      [
        {
          label: t('menu.vertical.text.heading1'),
          icon: 'lucide:heading-1',
          onSelect: () => addTextLayer('Heading 1', { fontSize: 48, fontWeight: 'bold' }),
        },
        {
          label: t('menu.vertical.text.heading2'),
          icon: 'lucide:heading-2',
          onSelect: () => addTextLayer('Heading 2', { fontSize: 36, fontWeight: 'bold' }),
        },
        {
          label: t('menu.vertical.text.heading3'),
          icon: 'lucide:heading-3',
          onSelect: () => addTextLayer('Heading 3', { fontSize: 24, fontWeight: 'bold' }),
        },
        {
          label: t('menu.vertical.text.heading4'),
          icon: 'lucide:heading-4',
          onSelect: () => addTextLayer('Heading 4', { fontSize: 18, fontWeight: 'bold' }),
        },
        {
          label: t('menu.vertical.text.paragraph'),
          icon: 'lucide:paragraph',
          onSelect: () => addTextLayer('Paragraph text', { fontSize: 16 }),
        },
      ],
    ],
  },
  {
    label: t('menu.vertical.eraser'),
    icon: 'lucide:eraser',
    onSelect: () => eraseLayer(),
  },
  {
    label: t('menu.vertical.zoomIn'),
    icon: 'lucide:zoom-in',
    onSelect: () => zoomIn(),
  },
  {
    label: t('menu.vertical.zoomOut'),
    icon: 'lucide:zoom-out',
    onSelect: () => zoomOut(),
  },
  {
    label: t('menu.vertical.frame.frame'),
    icon: 'lucide:frame',
    children: [
      [
        {
          label: t('menu.vertical.frame.custom'),
          icon: 'lucide:frame',
          onSelect: () => updateFrameSettingsToImageDimension(),
        },
        {
          label: t('menu.vertical.frame.facebook'),
          icon: 'logos:facebook',
          onSelect: () => updateFrameSettings({
            width: 1200,
            height: 628,
            fill: '#1877F2',
            stroke: '#ccc',
            strokeWidth: 1,
          }),
        },
        {
          label: t('menu.vertical.frame.instagram'),
          icon: 'logos:instagram',
          onSelect: () => updateFrameSettings({
            width: 1080,
            height: 1080,
            fill: '#E1306C',
            stroke: '#ccc',
            strokeWidth: 1,
          }),
        },
        {
          label: t('menu.vertical.frame.twitter'),
          icon: 'logos:twitter',
          onSelect: () => updateFrameSettings({
            width: 1200,
            height: 675,
            fill: '#1DA1F2',
            stroke: '#ccc',
            strokeWidth: 1,
          }),
        },
      ],
    ],
  },
])
</script>

<template>
  <header
    class="fixed top-40 left-6 z-40 backdrop-blur-md bg-background/20 border border-background-foreground/10 rounded-2xl shadow-2xl flex flex-col">
    <template v-for="(item, index) in menuItems" :key="`dropdown-${index}`">
      <UButton v-if="!item.children" variant="link" color="neutral"
        class="flex flex-col my-2 px-1 py-1 h-12 cursor-pointer" @click="item.onSelect">
        <Icon :name="String(item.icon)" class="w-5 h-5" />
        <span class="text-xs font-light">
          {{ item.label }}
        </span>
      </UButton>

      <UDropdownMenu v-else class="flex flex-col cursor-pointer" :items="[item]">
        <UButton size="lg" variant="link" color="neutral" class="flex flex-col my-2 px-1 py-1 h-12"
          @click="item.onSelect">
          <Icon :name="String(item.icon)" class="w-5 h-5" />
          <span class="text-xs font-light">
            {{ item.label }}
          </span>
        </UButton>
      </UDropdownMenu>
    </template>
  </header>
</template>
<style scoped></style>
