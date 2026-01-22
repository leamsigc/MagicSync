<script lang="ts" setup>
/**
 *
 * Component Description:Sidebar menu for Fabric Editor with draggable functionality
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CSSProperties } from 'vue';
import { useDraggable } from '@vueuse/core';
import { useImageFilterStyles, useTextStyles } from '../composables/useTextStyles';
import type { AspectRatios, BackgroundControls, FontFamilies, TextLayer, TextStyle, } from '../composables/useTextStyles';

interface Props {
  isOverflowing: boolean;
  textLayers: TextLayer[];
  activeTextLayerId: string | null;
  aspectRatios: AspectRatios;
  aspectRatio: keyof AspectRatios;
  customSize: { width: number; height: number };
  optimizedBaseImage: HTMLImageElement | null;
  actualDimensions: { width: number; height: number };
  textControls: TextLayer | undefined;
  isMobile: boolean;
  stylesByCategory: Record<string, TextStyle[]>;
  newStyleName: string;
  customStyles: TextStyle[];
  selectedFontCategory: 'system' | 'google';
  fontFamilies: FontFamilies;
  positions: { top: string; left: string }[];
  activePosition: { top: string; left: string };
  backgroundControls: BackgroundControls;
  backgroundStyle: Record<string, string>;
  optimizedOverlayImage: HTMLImageElement | null;
  selectedFont: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits([
  'addTextLayer',
  'deleteTextLayer',
  'update:activeTextLayerId',
  'update:aspectRatio',
  'update:customSize',
  'update:textControls',
  'update:selectedFontCategory',
  'update:backgroundControls',
  'downloadCanvas',
  'reset',
  'update:showTextControlModal',
  'applyTextStyle',
  'saveCurrentAsCustomStyle',
  'handlePredefinedPosition',
  'onBackgroundImageUpload',
  'update:newStyleName',
  'applyFilterByName',
]);

const addTextLayer = () => emit('addTextLayer');
const deleteTextLayer = (id: string) => emit('deleteTextLayer', id);
const updateActiveTextLayerId = (id: string | null) =>
  emit('update:activeTextLayerId', id);
const updateAspectRatio = (key: keyof AspectRatios) =>
  emit('update:aspectRatio', key);
const updateCustomSize = (size: { width: number; height: number }) =>
  emit('update:customSize', size);
const updateTextControls = (controls: TextLayer) =>
  emit('update:textControls', controls);
const updateSelectedFontCategory = (category: 'system' | 'google') =>
  emit('update:selectedFontCategory', category);
const updateBackgroundControls = (controls: BackgroundControls) =>
  emit('update:backgroundControls', controls);
const downloadCanvas = () => emit('downloadCanvas');
const reset = () => emit('reset');
const updateShowTextControlModal = (value: boolean) =>
  emit('update:showTextControlModal', value);
const applyTextStyle = (style: TextStyle) => emit('applyTextStyle', style);
const applyFilter = (filterName: string) =>
  emit('applyFilterByName', filterName);
const saveCurrentAsCustomStyle = (name: string) =>
  emit('saveCurrentAsCustomStyle', name);
const handlePredefinedPosition = (position: { top: string; left: string }) =>
  emit('handlePredefinedPosition', position);
const onBackgroundImageUpload = (file: File | null | undefined) => {
  if (!file) return;
  emit('onBackgroundImageUpload', file);

}

const textControlsModel = computed({
  get: () => props.textControls,
  set: (value) => {
    console.log('Update textControls:', value);
    if (value) {

      updateTextControls(value);
    }
  },
});

const newStyleNameModel = computed({
  get: () => props.newStyleName,
  set: (value: string) => {
    // Explicitly type value as string
    emit('update:newStyleName', value); // Emit update event to parent
  },
});

const backgroundControlsModel = computed({
  get: () => props.backgroundControls,
  set: (value) => {

    updateBackgroundControls(value);
  },
});

const selectedFontCategoryModel = computed({
  get: () => props.selectedFontCategory,
  set: (value) => {
    updateSelectedFontCategory(value);
  },
});

const el = useTemplateRef<HTMLElement>('el');
const handler = useTemplateRef<HTMLElement>('handler');

const { style } = useDraggable(el, {
  initialValue: { x: 0, y: 200 },
  handle: handler,
});

const { presets } = useImageFilterStyles();
const { baseImageStyles, overlayImageStyles } = useTextStyles();

// Active image type for controls
const activeImageType = ref<'base' | 'overlay'>('base');
</script>

<template>
  <div class="flex justify-center items-center mt-20 absolute bottom-5 left-0 right-0">
    <div class="flex bg-black p-2 rounded-full gap-3 relative">
      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:layers" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid">
            <header ref="handler" class="text-center">
              <h2>Text Behind Image Editor</h2>
              <p>Drag to move the text or the Settings</p>
            </header>
            <div class="flex justify-between items-center mt-10 mb-5">
              <label class="text-sm font-medium">Text Layers</label>
              <UButton size="sm" variant="outline" @click="addTextLayer()">Add Layer</UButton>
            </div>
            <div class="grid gap-2">
              <div v-for="layer in textLayers" :key="layer.id"
                class="flex items-center justify-between p-2 border rounded-md"
                :class="{ 'border-primary': activeTextLayerId === layer.id }">
                <div class="flex-1 cursor-pointer" @click="updateActiveTextLayerId(layer.id)">
                  <span class="text-sm truncate">{{ layer.text || 'Empty Layer' }}</span>
                </div>
                <UButton variant="ghost" size="sm" @click="deleteTextLayer(layer.id)">
                  <Icon name="lucide:trash-2" class="h-4 w-4 text-red-500" />
                </UButton>
              </div>
            </div>
            <section class="my-4">
              <div class="grid items-center gap-4">
                <label class="block text-sm font-medium text-gray-700">Text content
                </label>
                <UTextarea v-if="textControlsModel" v-model="textControlsModel.text" :rows="3" />
              </div>
            </section>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:ratio" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid">
            <header class="text-center">
              <h2>Social Media Presets</h2>
              <p>Social media aspect ratios and predefined positions</p>
            </header>
            <section class="grid grid-cols-2 gap-2 my-4">
              <UButton v-for="(ratio, key) in aspectRatios" :key="key" variant="outline" color="neutral"
                :class="{ 'border-primary': aspectRatios[aspectRatio]?.label === ratio.label }"
                @click="updateAspectRatio(key)">
                <div class="flex flex-col items-start">
                  <span class="text-sm">{{ ratio.label }}</span>
                  <span class="text-xs text-muted-foreground">{{ ratio.width }}x{{ ratio.height }}
                  </span>
                </div>
              </UButton>
            </section>
            <section class="grid max-w-sm">
              <div v-if="aspectRatio === 'custom'" class="space-y-4">
                <div class="flex gap-4">
                  <div class="flex-1">
                    <label class="text-sm font-medium">Width (px)</label>
                    <UInput type="number" v-model="customSize.width" min="1" :step="10"
                      @update:model-value="(val: string | number) => updateCustomSize({ ...customSize, width: Number(val) })" />
                  </div>
                  <div class="flex-1">
                    <label class="text-sm font-medium">Height (px)</label>
                    <UInput type="number" v-model="customSize.height" min="1" :step="10"
                      @update:model-value="(val: string | number) => updateCustomSize({ ...customSize, height: Number(val) })" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <UButton variant="outline" @click="() => {
                    updateCustomSize({ width: 1080, height: 1080 });
                  }">
                    1:1
                  </UButton>
                  <UButton variant="outline" @click="() => {
                    updateCustomSize({ width: 1920, height: 1080 });
                  }">
                    16:9
                  </UButton>
                  <UButton variant="outline" @click="() => {
                    if (optimizedBaseImage) {
                      updateCustomSize({ width: optimizedBaseImage.naturalWidth, height: optimizedBaseImage.naturalHeight });
                    }
                  }">
                    Image Size
                  </UButton>
                </div>
              </div>
            </section>
            <section class="my-4">
              <header>Current aspect ratio:</header>
              <div variant="ghost" title="Change aspect ratio"
                class="text-gray-400 p-2 rounded-full  flex items-center space-x-1 text-sm">
                <Icon name="material-symbols-light:image-aspect-ratio-outline" class="h-4 w-4" />
                <span>
                  {{ aspectRatios[aspectRatio]?.label }}
                </span>
              </div>
              <header class="">
                Current: {{ actualDimensions.width }}x{{ actualDimensions.height }}px
              </header>
            </section>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:text" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid max-h-96 overflow-auto max-w-sm">
            <header class="text-center">
              <h2>Text Presets</h2>
              <p>Edit the text related settings</p>
            </header>
            <section class="grid gap-2 grid-cols-1">
              <div class="grid items-center gap-4">
                <label class="text-sm font-medium">Font Family</label>
                <div class="space-y-4">
                  <!-- Font Category Selection -->
                  <div class="flex gap-2">
                    <UButton variant="outline"
                      :class="{ 'bg-primary text-primary-foreground': selectedFontCategoryModel === 'system' }"
                      @click="selectedFontCategoryModel = 'system'">
                      System
                    </UButton>
                    <UButton variant="outline"
                      :class="{ 'bg-primary text-primary-foreground': selectedFontCategoryModel === 'google' }"
                      @click="selectedFontCategoryModel = 'google'">
                      Google
                    </UButton>
                  </div>

                  <!-- Font Selection -->
                  <USelectMenu v-if="textControlsModel?.fontFamily" v-model="textControlsModel.fontFamily"
                    value-key="value" :items="selectedFontCategoryModel === 'system' ? [
                      { type: 'label', label: 'Sans-serif', style: { fontFamily: 'serif' } },
                      ...fontFamilies.system.filter(f => f.family.includes('sans-serif')).map(font => ({
                        label: font.name,
                        value: font.family,
                        style: { fontFamily: font.family },
                      })),
                      { type: 'label', label: 'Serif' },
                      ...fontFamilies.system.filter(f => f.family.includes('serif') && !f.family.includes('sans-serif')).map(font => ({
                        label: font.name,
                        value: font.family,
                        style: { fontFamily: font.family },
                      })),
                      { type: 'label', label: 'Monospace' },
                      ...fontFamilies.system.filter(f => f.family.includes('monospace')).map(font => ({
                        label: font.name,
                        value: font.family,
                        style: { fontFamily: font.family },
                      })),
                      { type: 'label', label: 'Decorative' },
                      ...fontFamilies.system.filter(f => f.family.includes('cursive') || f.family.includes('fantasy')).map(font => ({
                        label: font.name,
                        value: font.family,
                        style: { fontFamily: font.family },

                      }))
                    ] : fontFamilies.google.map(font => ({
                      label: font.name,
                      value: font.family,
                      style: { fontFamily: font.family },
                    }))" class="min-w-80 w-full" />

                  <!-- Font Preview -->
                  <div class="p-4 border rounded-lg text-center"
                    :style="{ fontFamily: textControlsModel?.fontFamily, }">
                    The quick brown fox jumps over the lazy dog
                  </div>
                </div>
              </div>
              <div v-if="textControlsModel && textControlsModel.fontSize" class="grid  items-center gap-4">
                <label class="text-sm font-medium">Font Size</label>
                <div class="flex items-center gap-2">
                  <USlider v-model="textControlsModel.fontSize" :min="40" :max="550" :step="5" class="flex-1" />
                  <span class="w-12 text-sm">{{ textControlsModel!.fontSize }}px</span>
                </div>
              </div>
              <div v-if="textControlsModel" class="grid  items-center gap-4">
                <label class="text-sm font-medium">Text Style</label>
                <div class="flex gap-2">
                  <UButton size="sm" :variant="textControlsModel!.fontWeight === 'bold' ? 'solid' : 'outline'"
                    @click="textControlsModel!.fontWeight = textControlsModel!.fontWeight === 'bold' ? 'normal' : 'bold'">
                    <Icon name="material-symbols:format-bold" />
                  </UButton>
                  <UButton size="sm" :variant="textControlsModel!.fontStyle === 'italic' ? 'solid' : 'outline'"
                    @click="textControlsModel!.fontStyle = textControlsModel!.fontStyle === 'italic' ? 'normal' : 'italic'">
                    <Icon name="material-symbols:format-italic" />
                  </UButton>
                </div>
              </div>
              <div class="grid  items-center gap-4">
                <label class="text-sm font-medium">Text Color</label>
                <UColorPicker v-model="textControlsModel!.color" />
              </div>
              <div v-if="textControlsModel && textControlsModel.shadow" class="grid  items-center gap-4">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">Text Shadow</label>
                  <USwitch v-model="textControlsModel!.shadow.enabled" />
                </div>

                <div v-if="textControlsModel!.shadow.enabled" class="space-y-4">
                  <div class="space-y-2">
                    <label class="text-sm font-medium">Shadow Color</label>
                    <UColorPicker v-model="textControlsModel!.shadow.color" />
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-medium">Blur</label>
                    <USlider v-model="textControlsModel!.shadow.blur" :min="0" :max="20" :step="1" />
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-medium">Offset X</label>
                    <USlider v-model="textControlsModel!.shadow.offsetX" :min="-10" :max="10" :step="1" />
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-medium">Offset Y</label>
                    <USlider v-model="textControlsModel!.shadow.offsetY" :min="-10" :max="10" :step="1" />
                  </div>
                </div>
              </div>
            </section>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:layout-template" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid max-h-96 overflow-auto max-w-sm">
            <header class="text-center">
              <h2>Text preset templates</h2>
              <p>Use text preset templates</p>
            </header>
            <section>
              <div class="grid grid-cols-1 gap-2">
                <!-- Categories -->
                <div v-for="(styles, category) in stylesByCategory" :key="category" class="space-y-2">
                  <label class="capitalize text-xs text-muted-foreground">{{ category }}
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <UButton v-for="style in styles" :key="style.name" variant="outline"
                      class="h-auto p-2 justify-start relative group" @click="applyTextStyle(style)">
                      <div class="text-left w-full">
                        <div class="text-sm font-medium mb-2">{{ style.name }}</div>
                        <div class="text-xs truncate mt-1" :style="{
                          fontFamily: style.style.fontFamily,
                          fontSize: '16px',
                          fontWeight: style.style.fontWeight,
                          fontStyle: style.style.fontStyle,
                          color: style.style.color,
                          textTransform: style.style.textTransform,
                          WebkitTextStroke: style.style.textStroke,
                          textShadow: style.style.shadow.multiShadow ||
                            (style.style.shadow.enabled ?
                              `${style.style.shadow.offsetX}px ${style.style.shadow.offsetY}px ${style.style.shadow.blur}px ${style.style.shadow.color}` :
                              'none'),
                          background: style.style.backgroundGradient,
                          WebkitBackgroundClip: style.style.backgroundClip === 'text' ? 'text' : 'border-box',
                          WebkitTextFillColor: style.style.backgroundClip === 'text' ? 'transparent' : 'inherit'
                        } as CSSProperties">
                          {{ textControlsModel?.text || 'Preview Text' }}
                        </div>
                      </div>
                      <div
                        class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-primary/10 transition-opacity" />
                    </UButton>
                  </div>
                </div>
              </div>
            </section>
            <section class="grid gap-2 mt-4">
              <label class="text-xs text-muted-foreground">Save current style:</label>
              <UInput :model-value="newStyleNameModel" placeholder="Style name..." class="flex-1"
                @update:model-value="(val: string | number) => newStyleNameModel = String(val)" />
              <UButton variant="outline"
                @click="saveCurrentAsCustomStyle(String(newStyleNameModel) || `Custom ${String(customStyles.length + 1)}`)">
                Save Style
              </UButton>
            </section>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:align-center" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid max-h-96 overflow-auto max-w-sm">
            <header class="text-center">
              <h2>Text Position</h2>
              <p>Drag to move the text</p>
            </header>
            <section v-if="textControlsModel" class="space-y-4">
              <div>
                <label class="text-sm font-medium">Scale</label>
                <div class="flex items-center gap-2">
                  <USlider v-model="textControlsModel.scale" :min="0" :max="10" :step="0.1" class="flex-1" />
                  <span class="w-12 text-sm">{{ textControlsModel!.scale }}</span>
                </div>
              </div>
              <div>
                <label class="text-sm font-medium">Position X (%)</label>
                <div class="flex items-center gap-2">
                  <USlider v-model="textControlsModel!.positionX" :min="0" :max="100" :step="1" class="flex-1" />
                  <span class="w-12 text-sm">{{ textControlsModel!.positionX }}%</span>
                </div>
              </div>
              <div>
                <label class="text-sm font-medium">Position Y (%)</label>
                <div class="flex items-center gap-2">
                  <USlider v-model="textControlsModel!.positionY" :min="0" :max="100" :step="1" class="flex-1" />
                  <span class="w-12 text-sm">{{ textControlsModel!.positionY }}%</span>
                </div>
              </div>
              <div>
                <label class="text-sm font-medium">Z-Index</label>
                <div class="flex items-center gap-2">
                  <USlider v-model="textControlsModel.zIndex" :min="0" :max="100" :step="1" class="flex-1" />
                  <span class="w-12 text-sm">{{ textControlsModel.zIndex }}</span>
                </div>
              </div>
            </section>
            <div class="grid gap-1 grid-cols-5 my-5">
              <UButton v-for="position in positions" :key="position.top + position.left" class="size-14 p-1 "
                @click="handlePredefinedPosition(position)">
                <span v-if="activePosition.top === position.top && activePosition.left === position.left"
                  class="size-12 bg-black/40" />
              </UButton>
            </div>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:paint-bucket" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid max-h-96 overflow-auto max-w-sm">
            <header class="text-center">
              <h2>Background</h2>
              <p>Update the main background</p>
            </header>

            <!-- Opacity Control -->
            <div class="grid gap-2 my-4">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Opacity</label>
                <span class="text-sm">
                  {{ Math.round((backgroundControlsModel.opacity || 1) * 100) }}%
                </span>
              </div>
              <USlider v-model="backgroundControlsModel.opacity" :min="0" :max="1" :step="0.01" class="flex-1" />
            </div>
            <section class="grid my-4 gap-2">
              <label class="text-sm font-medium">Background Type</label>
              <USelectMenu v-model="backgroundControlsModel.type" value-key="value" :items="[
                { label: 'None', value: 'none' },
                { label: 'Gradient', value: 'gradient' },
                { label: 'Image', value: 'image' },
                { label: 'Gradient + Image', value: 'gradient-image' }
              ]" />
            </section>
            <!-- Gradient Controls -->
            <div v-if="backgroundControlsModel.type.includes('gradient')" class="space-y-4 grid">
              <div>
                <label class="text-sm font-medium">Gradient Direction</label>
                <UInput v-model="backgroundControlsModel.gradient.direction" placeholder="45deg" />
              </div>
              <div>
                <label class="text-sm font-medium">Gradient Colors</label>
                <div class="grid gap-2">
                  <UColorPicker v-for="(color, index) in backgroundControlsModel.gradient.colors" :key="index"
                    v-model="backgroundControlsModel.gradient.colors[index]" class="" />
                </div>
              </div>
            </div>

            <!-- Image Upload -->
            <div v-if="backgroundControlsModel.type.includes('image')" class="space-y-4">
              <div>
                <label class="text-sm font-medium">Upload Image</label>
                <UFileUpload type="file" accept="image/*" class="w-full" @update:modelValue="onBackgroundImageUpload" />
              </div>
            </div>

            <!-- Predefined Backgrounds -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Predefined Backgrounds</label>
              <div class="grid grid-cols-3 gap-2">
                <UButton v-for="bg in backgroundControlsModel.predefinedBackgrounds" :key="bg.name"
                  class="h-20 rounded-lg overflow-hidden hover:ring-2 ring-primary" :style="{

                    backgroundImage: bg.image ? `url(${bg.image})` : '',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    ...{

                      background: bg.type.includes('gradient')
                        ? `linear-gradient(${bg.gradient.direction}, ${bg.gradient.colors.join(', ')})`
                        : '',
                    }
                  }" @click="() => {
                    backgroundControlsModel.type = bg.type;
                    backgroundControlsModel.gradient = bg.gradient;
                    backgroundControlsModel.image = bg.image || null;
                  }">
                  <span class="sr-only">{{ bg.name }}
                    {{ bg }}
                  </span>
                </UButton>
              </div>
            </div>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:image" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid max-h-96 overflow-auto max-w-sm">
            <header class="text-center">
              <h2>Image Styles</h2>
              <p>Base and overlay image controls</p>
            </header>

            <!-- Image Type Selection -->
            <div class="flex gap-2 my-4">
              <UButton variant="outline" class="flex-1"
                :class="{ 'bg-primary text-primary-foreground': activeImageType === 'base' }"
                @click="activeImageType = 'base'">
                Base Image
              </UButton>
              <UButton variant="outline" class="flex-1"
                :class="{ 'bg-primary text-primary-foreground': activeImageType === 'overlay' }"
                @click="activeImageType = 'overlay'">
                Overlay Image
              </UButton>
            </div>

            <!-- Base Image Controls -->
            <div v-if="activeImageType === 'base'" class="space-y-4">
              <h3 class="text-sm font-medium">Base Image Styles</h3>

              <!-- Opacity -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">Opacity</label>
                  <span class="text-sm">{{ Math.round(baseImageStyles.opacity * 100) }}%</span>
                </div>
                <USlider v-model="baseImageStyles.opacity" :min="0" :max="1" :step="0.01" />
              </div>

              <!-- Shadow -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">Shadow</label>
                  <USwitch v-model="baseImageStyles.shadow.enabled" />
                </div>
                <div v-if="baseImageStyles.shadow.enabled" class="space-y-3 grid gap-4">
                  <div>
                    <label class="text-sm">Color</label>
                    <UColorPicker v-model="baseImageStyles.shadow.color" class="mt-1" />
                  </div>
                  <div>
                    <label class="text-sm">Blur</label>
                    <USlider v-model="baseImageStyles.shadow.blur" :min="0" :max="20" :step="1" />
                  </div>
                  <div>
                    <label class="text-sm">Offset X</label>
                    <USlider v-model="baseImageStyles.shadow.offsetX" :min="-10" :max="10" :step="1" />
                  </div>
                  <div>
                    <label class="text-sm">Offset Y</label>
                    <USlider v-model="baseImageStyles.shadow.offsetY" :min="-10" :max="10" :step="1" />
                  </div>
                </div>
              </div>

              <!-- Position -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Object Position</label>
                <USelectMenu v-model="baseImageStyles.position.objectPosition" :items="[
                  { label: 'Center', value: 'center' },
                  { label: 'Top', value: 'top' },
                  { label: 'Bottom', value: 'bottom' },
                  { label: 'Left', value: 'left' },
                  { label: 'Right', value: 'right' },
                  { label: 'Top Left', value: 'top left' },
                  { label: 'Top Right', value: 'top right' },
                  { label: 'Bottom Left', value: 'bottom left' },
                  { label: 'Bottom Right', value: 'bottom right' }
                ]" value-key="value" />
              </div>

              <!-- Transform -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Transform</label>
                <UInput v-model="baseImageStyles.position.transform" placeholder="e.g., scale(1.1) rotate(5deg)" />
              </div>

              <!-- Custom Filter -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Custom Filter</label>
                <UInput v-model="baseImageStyles.customFilter" placeholder="e.g., brightness(1.2) contrast(1.1)" />
              </div>
            </div>

            <!-- Overlay Image Controls -->
            <div v-if="activeImageType === 'overlay'" class="space-y-4">
              <h3 class="text-sm font-medium">Overlay Image Styles</h3>

              <!-- Opacity -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">Opacity</label>
                  <span class="text-sm">{{ Math.round(overlayImageStyles.opacity * 100) }}%</span>
                </div>
                <USlider v-model="overlayImageStyles.opacity" :min="0" :max="1" :step="0.01" />
              </div>

              <!-- Shadow -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">Shadow</label>
                  <USwitch v-model="overlayImageStyles.shadow.enabled" />
                </div>
                <div v-if="overlayImageStyles.shadow.enabled" class="space-y-3  grid gap-4">
                  <label class="text-sm mb-2">Color</label>
                  <UColorPicker v-model="overlayImageStyles.shadow.color" class="mt-1" />
                  <label class="text-sm mb-2">Blur</label>
                  <USlider v-model="overlayImageStyles.shadow.blur" :min="0" :max="20" :step="1" />
                  <label class="text-sm mb-2">Offset X</label>
                  <USlider v-model="overlayImageStyles.shadow.offsetX" :min="-10" :max="10" :step="1" />
                  <label class="text-sm mb-2">Offset Y</label>
                  <USlider v-model="overlayImageStyles.shadow.offsetY" :min="-10" :max="10" :step="1" />
                </div>
              </div>

              <!-- Position -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Object Position</label>
                <USelectMenu v-model="overlayImageStyles.position.objectPosition" :items="[
                  { label: 'Center', value: 'center' },
                  { label: 'Top', value: 'top' },
                  { label: 'Bottom', value: 'bottom' },
                  { label: 'Left', value: 'left' },
                  { label: 'Right', value: 'right' },
                  { label: 'Top Left', value: 'top left' },
                  { label: 'Top Right', value: 'top right' },
                  { label: 'Bottom Left', value: 'bottom left' },
                  { label: 'Bottom Right', value: 'bottom right' }
                ]" value-key="value" />
              </div>

              <!-- Transform -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Transform</label>
                <UInput v-model="overlayImageStyles.position.transform" placeholder="e.g., scale(1.1) rotate(5deg)" />
              </div>

              <!-- Custom Filter -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Custom Filter</label>
                <UInput v-model="overlayImageStyles.customFilter" placeholder="e.g., brightness(1.2) contrast(1.1)" />
              </div>

              <!-- Filter Presets -->
              <div class="space-y-2 grid gap-4">
                <label class="text-sm font-medium">Filter Presets</label>
                <div class="grid grid-cols-4 gap-2">
                  <UButton v-for="filterPreset in presets" :key="filterPreset.name" :title="filterPreset.name"
                    variant="ghost" class="p-2 h-auto" @click="() => applyFilter(filterPreset.name)">
                    <img v-if="optimizedOverlayImage" :src="optimizedOverlayImage.src"
                      :style="{ filter: filterPreset.style }" class="w-full h-8 object-contain rounded">
                  </UButton>
                </div>
              </div>
            </div>
          </section>
        </template>
      </UPopover>

      <UPopover
        class="w-12 h-12 flex justify-center items-center rounded-full z-10 fill-white transition-color duration-500 ease-in-out">
        <UButton icon="lucide:activity" color="neutral" variant="subtle" />
        <template #content>
          <section class="p-4 grid max-h-96 overflow-auto max-w-sm">
            <header class="text-center">
              <h2>Actions</h2>
              <p>Actions for the editing view</p>
            </header>
            <div class="my-4 w-full">
              <UButton icon="lucide:download" title="Download" class=" text-center w-full" @click="downloadCanvas">
                <span>
                  Download
                </span>
              </UButton>
            </div>
            <div class="flex items-center gap-2">
              <UButton icon="lucide:refresh-cw" color="error" variant="outline" title="Reset" class="text-sm w-full"
                @click="reset">
                <span>Reset</span>
              </UButton>
            </div>
          </section>
        </template>
      </UPopover>

    </div>
  </div>
</template>

<style scoped>
/* Add any specific styles for SidebarMenu here if needed */
.font-roboto {
  font-family: Roboto, sans-serif;

}


.font-open-sans {
  font-family: "Open Sans", sans-serif;
}


.font-lato {
  font-family: Lato, sans-serif;

}


.font-montserrat {
  font-family: Montserrat, sans-serif;
}


.font-poppins {
  font-family: Poppins, sans-serif;
}

.font-meta {
  font-family: "Meta", sans-serif;
}


.font-playfair-display {
  font-family: "Playfair Display", serif
}



.font-sigmar {
  font-family: "Sigmar", serif;
}


.font-rancho {
  font-family: Rancho, cursive,
}

.font-oswald {
  font-family: "Oswald", sans-serif;
}


.font-bebas-neue {
  font-family: "Bebas Neue", sans-serif;
}

.font-anton {
  font-family: "Anton", sans-serif;
}


.font-playfair-display {

  font-family: "Playfair Display", serif;
}

.font-raleway {
  font-family: "Raleway", sans-serif;
}

.font-bungee {
  font-family: "Bungee", cursive;
}

.font-abril-fatface {
  font-family: "Abril Fatface", serif;
}


.font-fredoka-one {
  font-family: "Fredoka One", sans-serif;
}

.font-amatic-sc {
  font-family: "Amatic SC", cursive;
}


.font-lobster {
  font-family: "Lobster", cursive;
}

.font-unica-one {
  font-family: "Unica One", sans-serif;
}


.font-orbitron {
  font-family: "Orbitron", sans-serif;
}

.font-exo-2 {
  font-family: "Exo 2", sans-serif;
}

.font-chivo {
  font-family: "Chivo", sans-serif;
}

.font-cinzel {
  font-family: "Cinzel", serif;
}


.font-bangers {
  font-family: "Bangers", cursive,
}
</style>
