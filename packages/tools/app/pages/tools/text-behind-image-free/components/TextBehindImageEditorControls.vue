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
import { useImageFilterStyles } from '../composables/useTextStyles';
import type { AspectRatios, BackgroundControls, FontFamilies, TextLayer, TextStyle } from '../composables/useTextStyles';

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
const onBackgroundImageUpload = (event: Event) =>
  emit('onBackgroundImageUpload', event);

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
</script>

<template>
  <section ref="el" :style="style" class="fixed max-w-md w-[500px]  max-h-[600px]">
    <div
      class="flex flex-col gap-2 bg-slate-950/80 backdrop-blur-sm rounded px-5 z-50 max-w-md w-[500px]  max-h-[600px]">
      <header ref="handler" class="text-center">
        <h2>Text Behind Image Editor</h2>
        <p>Drag to move the text or the Settings</p>
      </header>
      <section class="overflow-y-auto overflow-x-hidden p-4">
        <div class="flex flex-col gap-2">
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <label class="text-sm font-medium">Text Layers</label>
              <UButton size="sm" variant="outline" @click="addTextLayer()">Add Layer</UButton>
            </div>
            <div class="space-y-2">
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
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <UButton variant="ghost" title="Change aspect ratio"
            class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 flex items-center space-x-1 text-sm">
            <Icon name="material-symbols-light:image-aspect-ratio-outline" class="h-4 w-4" />
            <span>
              {{ aspectRatios[aspectRatio]?.label }}
            </span>
          </UButton>
          <div class="space-y-4">
            <!-- Social Media Presets -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Social Media</label>
              <div class="grid grid-cols-2 gap-2">
                <UButton v-for="(ratio, key) in aspectRatios" :key="key" variant="outline"
                  :class="{ 'border-primary': aspectRatio === key }" @click="updateAspectRatio(key)">
                  <div class="flex flex-col items-start">
                    <span class="text-sm">{{ ratio.label }}</span>
                    <span class="text-xs text-muted-foreground">{{ ratio.width }}x{{
                      ratio.height }}</span>
                  </div>
                </UButton>
              </div>
            </div>

            <!-- Custom Size Controls -->
            <div v-if="aspectRatio === 'custom'" class="space-y-4">
              <div class="flex gap-4">
                <div class="flex-1">
                  <label class="text-sm font-medium">Width (px)</label>
                  <UInput type="number" :model-value="customSize.width" min="1" :step="10"
                    @update:model-value="(val: string | number) => updateCustomSize({ ...customSize, width: Number(val) })" />
                </div>
                <div class="flex-1">
                  <label class="text-sm font-medium">Height (px)</label>
                  <UInput type="number" :model-value="customSize.height" min="1" :step="10"
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

            <!-- Current Size Display -->
            <div class="pt-2 border-t">
              <p class="text-sm text-muted-foreground">
                Current: {{ actualDimensions.width }}x{{ actualDimensions.height }}px
              </p>
            </div>
          </div>
        </div>
        <div>
          <UButton variant="ghost" title="Change text"
            class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 flex items-center space-x-1 text-sm">
            <Icon name="lucide:pen-tool" class=" h-4 w-4" />
            <span>
              Change text
            </span>
          </UButton>
          <div class="grid gap-4">
            <div class="grid gap-2">
              <div class="grid items-center gap-4">
                <UButton variant="outline" @click="addTextLayer"> Add new layer</UButton>
                <label class="block text-sm font-medium text-gray-700">Text content
                </label>
                <UTextarea v-if="textControlsModel" v-model="textControlsModel.text" :rows="3" />
              </div>
            </div>
          </div>

        </div>
        <div>
          <UButton variant="ghost" title="Text controls"
            class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 flex items-center space-x-1 text-sm">
            <Icon name="material-symbols:text-ad" class=" h-4 w-4" />
            <span> Text Controls </span>
          </UButton>
          <div class="space-y-4">
            <!-- Text Style Presets -->
            <div class="grid gap-2">
              <label class="text-sm font-medium">Style Presets</label>
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

              <!-- Save Current Style -->
              <div class="flex gap-2 mt-4">
                <UInput :model-value="newStyleNameModel" placeholder="Style name..." class="flex-1"
                  @update:model-value="(val: string | number) => newStyleNameModel = String(val)" />
                <UButton variant="outline"
                  @click="saveCurrentAsCustomStyle(String(newStyleNameModel) || `Custom ${String(customStyles.length + 1)}`)">
                  Save Style
                </UButton>
              </div>
            </div>

            <USeparator class="my-4" />

            <!-- Existing text controls continue here -->
            <div class="grid gap-2 grid-cols-2">
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
                  <USelectMenu v-if="textControlsModel?.fontFamily" v-model="textControlsModel.fontFamily" :items="selectedFontCategoryModel === 'system' ? [
                    { type: 'label', label: 'Sans-serif' },
                    ...fontFamilies.system.filter(f => f.family.includes('sans-serif')).map(font => ({
                      label: font.name,
                      value: font.family,
                      style: { fontFamily: font.family }
                    })),
                    { type: 'label', label: 'Serif' },
                    ...fontFamilies.system.filter(f => f.family.includes('serif') && !f.family.includes('sans-serif')).map(font => ({
                      label: font.name,
                      value: font.family,
                      style: { fontFamily: font.family }
                    })),
                    { type: 'label', label: 'Monospace' },
                    ...fontFamilies.system.filter(f => f.family.includes('monospace')).map(font => ({
                      label: font.name,
                      value: font.family,
                      style: { fontFamily: font.family }
                    })),
                    { type: 'label', label: 'Decorative' },
                    ...fontFamilies.system.filter(f => f.family.includes('cursive') || f.family.includes('fantasy')).map(font => ({
                      label: font.name,
                      value: font.family,
                      style: { fontFamily: font.family }
                    }))
                  ] : fontFamilies.google.map(font => ({
                    label: font.name,
                    value: font.family,
                    style: { fontFamily: font.family }
                  }))" />

                  <!-- Font Preview -->
                  <div class="p-4 border rounded-lg text-center" :style="{ fontFamily: textControlsModel?.fontFamily }">
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
            </div>
          </div>
        </div>
        <div>
          <!-- Add position controller in popover -->
          <UButton variant="ghost" title="Change position and scale"
            class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 flex items-center space-x-1 text-sm">
            <Icon name="lucide:align-start-vertical" />
          </UButton>
          <label class="block text-sm font-medium text-gray-700">
            Position/Scale
          </label>
          <div class="grid gap-1 grid-cols-5 my-5">
            <UButton v-for="position in positions" :key="position.top + position.left" class="size-14 p-1 "
              @click="handlePredefinedPosition(position)">
              <span v-if="activePosition.top === position.top && activePosition.left === position.left"
                class="size-12 bg-black/40" />
            </UButton>
          </div>
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
        </div>
        <div>
          <!-- Main background popover and selection of base backgrounds -->
          <UButton variant="ghost" title="Change background"
            class="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 flex items-center space-x-1 text-sm">
            <Icon name="lucide:image" class="h-4 w-4" />
            <span>
              Background
            </span>
          </UButton>
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium">Background Type</label>
              <USelectMenu v-model="backgroundControlsModel.type" :items="[
                { label: 'None', value: 'none' },
                { label: 'Gradient', value: 'gradient' },
                { label: 'Image', value: 'image' },
                { label: 'Gradient + Image', value: 'gradient-image' }
              ]" />
            </div>

            <!-- Gradient Controls -->
            <div v-if="backgroundControlsModel.type.includes('gradient')" class="space-y-4">
              <div>
                <label class="text-sm font-medium">Gradient Direction</label>
                <UInput v-model="backgroundControlsModel.gradient.direction" placeholder="45deg" />
              </div>
              <div>
                <label class="text-sm font-medium">Gradient Colors</label>
                <div class="flex gap-2">
                  <UColorPicker v-for="(color, index) in backgroundControlsModel.gradient.colors" :key="index"
                    v-model="backgroundControlsModel.gradient.colors[index]" />
                </div>
              </div>
            </div>

            <!-- Image Upload -->
            <div v-if="backgroundControlsModel.type.includes('image')" class="space-y-4">
              <div>
                <label class="text-sm font-medium">Upload Image</label>
                <UFileUpload type="file" accept="image/*" class="w-full" @change="onBackgroundImageUpload" />
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

            <!-- Opacity Control -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Opacity</label>
                <span class="text-sm">{{ Math.round((backgroundControlsModel.opacity[0] || 1) * 100)
                  }}%</span>
              </div>
              <USlider v-model="backgroundControlsModel.opacity" :min="0" :max="1" :step="0.01" class="flex-1" />
            </div>
          </div>
        </div>
        <div class="my-4 grid grid-cols-4 gap-4">
          <UButton v-for="filterPreset in presets" :title="filterPreset.name" class=" text-sm w-full"
            @click="() => applyFilter(filterPreset.name)">
            <span class="text-sm">
              {{ filterPreset.name }}
            </span>
          </UButton>
        </div>
        <div class="my-4 w-full">
          <UButton title="Download" class=" text-sm w-full" @click="downloadCanvas">
            <Icon name="lucide:download" class=" h-4 w-4" />
            <span>
              Download
            </span>
          </UButton>
        </div>
        <div class="flex items-center gap-2">
          <UButton color="error" variant="solid" title="Reset" class="text-sm w-full" @click="reset">
            <Icon name="lucide:rotate-ccw" class="w-4 h-4" />
            <span>Reset</span>
          </UButton>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
/* Add any specific styles for SidebarMenu here if needed */
</style>
