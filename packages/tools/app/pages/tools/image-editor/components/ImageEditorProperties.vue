<i18n src="../ImageEditor.json"></i18n>
<script lang="ts" setup>
import { computed, watch, ref } from 'vue';
import { IText, FabricImage, type ITextProps } from 'fabric';
import { useFabricJs } from '../composables/useFabricJs';

// --- IMPORTS REUSE ---
interface TextAdjustmentProps {
  fontSize?: number;
  fontFamily?: string;
  fill?: string | null;
  fontWeight?: 'normal' | 'bold' | number | string;
  fontStyle?: 'normal' | 'italic' | string;
  underline?: boolean;
  linethrough?: boolean;
  overline?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify' | string;
}

const { t } = useI18n();
const toast = useToast();
const {
  editor,
  triggerRemoveBackground,
} = useFabricJs();

const { start, status } = useImageTransformer();

// --- STATE ---
const activeTab = ref('design'); // design | export


const activeLayer = computed(() => editor?.value?.activeLayer?.value);
const isTextLayerActive = computed(() => activeLayer.value?.type === 'i-text' || activeLayer.value?.type === 'text');
const isImageLayerActive = computed(() => activeLayer.value?.type === 'image');
const isShapeLayerActive = computed(() => ['rect', 'circle', 'triangle', 'path'].includes(activeLayer.value?.type || ''));
const isNoSelection = computed(() => !activeLayer.value);

// --- TRANSFORM STATE ---
const position = ref({ x: 0, y: 0 });
const size = ref({ width: 0, height: 0 });
const opacity = ref(100);

// --- APPEARANCE STATE ---
const objectFill = ref('#cccccc');
const stroke = ref({
  width: 0,
  color: '#000000',
  style: 'solid'
});
const shadow = ref({
  enabled: false,
  offsetX: 5,
  offsetY: 5,
  blur: 10,
  color: '#000000'
});

// --- TEXT STATE ---
const localTextSettings = ref<TextAdjustmentProps>({});
const textProps = ref({
  letterSpacing: 0,
  lineHeight: 1.16
});

// --- FILTER STATE ---
const presetFilter = ref('None');
const filtersRef = ref({
  Brightness: 0,
  Contrast: 0,
  Saturation: 0,
  Hue: 0,
  Blur: 0,
});

// --- RULER STATE ---
const showRulers = ref(false);
const snapToGuides = ref(true);
const guidelines = ref<Array<{ id: string; orientation: string; position: number }>>([]);

// --- BACKGROUND STATE ---
const background = ref({
  type: 'none',
  solidColor: '#ffffff',
  gradientType: 'linear',
  gradientColors: ['#ffffff', '#000000'],
  gradientAngle: 0
});


// --- WATCHERS & HELPERS ---
const extractTextProps = (obj: any): TextAdjustmentProps => ({
  fontSize: obj.fontSize,
  fontFamily: obj.fontFamily,
  fill: typeof obj.fill === 'string' ? obj.fill : '#000000',
  fontWeight: obj.fontWeight,
  fontStyle: obj.fontStyle,
  underline: obj.underline,
  linethrough: obj.linethrough,
  overline: obj.overline,
  textAlign: obj.textAlign,
});

watch(activeLayer, (newVal) => {
  if (newVal) {
    // Transform
    position.value = { x: Math.round(newVal.left || 0), y: Math.round(newVal.top || 0) };
    size.value = { width: Math.round((newVal.width || 0) * (newVal.scaleX || 1)), height: Math.round((newVal.height || 0) * (newVal.scaleY || 1)) };
    opacity.value = (newVal.opacity || 1) * 100;

    // Fill
    if (typeof newVal.fill === 'string') objectFill.value = newVal.fill;

    // Stroke
    stroke.value = {
      width: newVal.strokeWidth || 0,
      color: (newVal.stroke as string) || '#000000',
      style: newVal.strokeDashArray ? 'dashed' : 'solid'
    };

    // Shadow
    if (newVal.shadow) {
      const s = newVal.shadow as any;
      shadow.value = { enabled: true, offsetX: s.offsetX || 0, offsetY: s.offsetY || 0, blur: s.blur || 0, color: s.color || '#000000' };
    } else {
      shadow.value.enabled = false;
    }

    // Text
    if (newVal.type === 'i-text' || newVal.type === 'text') {
      localTextSettings.value = extractTextProps(newVal);
      textProps.value.letterSpacing = ((newVal as any).charSpacing || 0) / 10;
      textProps.value.lineHeight = (newVal as any).lineHeight || 1.16;
    }
  }
}, { immediate: true });

// --- ACTIONS ---
const updatePosition = () => editor.value?.setPosition?.(position.value.x, position.value.y);
const handleOpacityUpdate = () => editor.value?.applyOpacity?.(opacity.value / 100);
const handleObjectFillUpdate = () => {
  if (activeLayer.value) {
    activeLayer.value.set('fill', objectFill.value);
    editor.value?.fabricCanvas?.requestRenderAll();
  }
};

const handleStrokeUpdate = () => {
  const dashArray = stroke.value.style === 'dashed' ? [10, 5] : undefined;
  editor.value?.updateStroke?.({ width: stroke.value.width, color: stroke.value.color, dashArray });
};

const handleShadowUpdate = () => {
  if (shadow.value.enabled) {
    editor.value?.updateShadow?.(shadow.value);
  } else {
    editor.value?.removeShadow?.();
  }
};

const updateTextSettings = (settings: any) => {
  // Simple wrapper
  Object.keys(settings).forEach(key => activeLayer.value?.set(key as any, settings[key]));
  editor.value?.fabricCanvas?.requestRenderAll();
};
const handleFilterUpdate = (name: string) => {
  editor?.value?.applyImageAdjustment?.(name, (filtersRef.value as any)[name] / 100);
};

const handleBackgroundUpdate = () => {
  if (background.value.type === 'none') editor.value?.clearBackground?.();
  else if (background.value.type === 'solid') editor.value?.setBackgroundColor?.(background.value.solidColor);
  else if (background.value.type === 'gradient') editor.value?.setBackgroundGradient?.({
    type: background.value.gradientType,
    colors: background.value.gradientColors,
    angle: background.value.gradientAngle
  });
};

const handleAddGuideline = (orientation: 'horizontal' | 'vertical') => {
  const pos = 100;
  const id = editor.value?.addGuideline?.(orientation, pos);
  if (id) guidelines.value.push({ id, orientation, position: pos });
};

const handleRemoveGuideline = (id: string) => {
  editor.value?.removeGuideline?.(id);
  guidelines.value = guidelines.value.filter(g => g.id !== id);
};

onMounted(() => {
  if (start) start();
});

const fontFamilies = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New', 'Roboto', 'Open Sans', 'Lato'];


</script>

<template>
  <div class="h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-[280px] flex flex-col">

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 dark:border-gray-800">
      <button class="flex-1 py-3 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === 'design' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        @click="activeTab = 'design'">
        Design
      </button>
      <button class="flex-1 py-3 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === 'export' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        @click="activeTab = 'export'">
        Export
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">

      <div v-if="activeTab === 'design'" class="space-y-6">

        <!-- ALIGNMENT (Always visible if selection) -->
        <div v-if="!isNoSelection">
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Align</h3>
          <div class="grid grid-cols-4 gap-1 mb-2">
            <UButton size="xs" variant="outline" icon="lucide:align-start-vertical"
              @click="editor.value?.alignObjects?.('left')" data-testid="align-left" />
            <UButton size="xs" variant="outline" icon="lucide:align-center-vertical"
              @click="editor.value?.alignObjects?.('center')" data-testid="align-center" />
            <UButton size="xs" variant="outline" icon="lucide:align-end-vertical"
              @click="editor.value?.alignObjects?.('right')" data-testid="align-right" />
            <UButton size="xs" variant="outline" icon="lucide:align-start-horizontal"
              @click="editor.value?.alignObjects?.('top')" data-testid="align-top" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <UButton size="xs" variant="ghost" class="text-[10px]"
              @click="editor.value?.distributeObjects?.('horizontal')">Dist. Horiz</UButton>
            <UButton size="xs" variant="ghost" class="text-[10px]"
              @click="editor.value?.distributeObjects?.('vertical')">Dist. Vert</UButton>
          </div>
        </div>

        <!-- TRANSFORM (Always visible if selection) -->
        <div v-if="!isNoSelection">
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Transform</h3>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">X</label>
              <UInput v-model.number="position.x" type="number" size="xs" @change="updatePosition" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">Y</label>
              <UInput v-model.number="position.y" type="number" size="xs" @change="updatePosition" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">W</label>
              <UInput v-model.number="size.width" type="number" size="xs" disabled />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">H</label>
              <UInput v-model.number="size.height" type="number" size="xs" disabled />
            </div>
          </div>
          <!-- Rotation / Opacity -->
          <div class="mt-2">
            <label class="text-[10px] text-gray-500 block mb-1">Opacity {{ opacity.toFixed(0) }}%</label>
            <USlider v-model="opacity" :min="0" :max="100" size="xs" @update:model-value="handleOpacityUpdate" />
          </div>
          <!-- Flip & Rotate -->
          <div class="grid grid-cols-4 gap-1 mt-2">
            <UButton size="xs" variant="outline" icon="lucide:flip-horizontal"
              @click="editor.value?.flip?.('horizontal')" data-testid="btn-flip-h" />
            <UButton size="xs" variant="outline" icon="lucide:flip-vertical" @click="editor.value?.flip?.('vertical')"
              data-testid="btn-flip-v" />
            <UButton size="xs" variant="outline" icon="lucide:rotate-ccw" @click="editor.value?.rotateObject?.('left')"
              data-testid="btn-rotate-l" />
            <UButton size="xs" variant="outline" icon="lucide:rotate-cw" @click="editor.value?.rotateObject?.('right')"
              data-testid="btn-rotate-r" />
          </div>
        </div>

        <!-- TEXT PROPERTIES -->
        <div v-if="isTextLayerActive">
          <hr class="border-gray-100 dark:border-gray-800 my-4" />
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Text</h3>

          <div class="space-y-3">
            <USelect v-model="localTextSettings.fontFamily" :options="fontFamilies" size="xs"
              @change="updateTextSettings({ fontFamily: localTextSettings.fontFamily })"
              data-testid="select-font-family" />

            <div class="flex items-center gap-2">
              <UInput v-model.number="localTextSettings.fontSize" type="number" size="xs" class="w-16"
                @change="updateTextSettings({ fontSize: localTextSettings.fontSize })" data-testid="input-font-size" />
              <div class="relative w-8 h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                <input type="color" v-model="localTextSettings.fill"
                  class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                  @input="updateTextSettings({ fill: localTextSettings.fill })" />
              </div>
            </div>

            <div class="flex gap-1">
              <UButton :variant="localTextSettings.fontWeight === 'bold' ? 'solid' : 'outline'" size="xs"
                icon="lucide:bold" class="flex-1"
                @click="() => { localTextSettings.fontWeight = localTextSettings.fontWeight === 'bold' ? 'normal' : 'bold'; updateTextSettings({ fontWeight: localTextSettings.fontWeight }) }"
                data-testid="btn-bold" />
              <UButton :variant="localTextSettings.fontStyle === 'italic' ? 'solid' : 'outline'" size="xs"
                icon="lucide:italic" class="flex-1"
                @click="() => { localTextSettings.fontStyle = localTextSettings.fontStyle === 'italic' ? 'normal' : 'italic'; updateTextSettings({ fontStyle: localTextSettings.fontStyle }) }"
                data-testid="btn-italic" />
              <UButton :variant="localTextSettings.underline ? 'solid' : 'outline'" size="xs" icon="lucide:underline"
                class="flex-1"
                @click="() => { localTextSettings.underline = !localTextSettings.underline; updateTextSettings({ underline: localTextSettings.underline }) }"
                data-testid="btn-underline" />
            </div>

            <section size="xs" class="w-full flex">
              <UButton :variant="localTextSettings.textAlign === 'left' ? 'solid' : 'outline'" icon="lucide:align-left"
                class="flex-1" @click="updateTextSettings({ textAlign: 'left' })" />
              <UButton :variant="localTextSettings.textAlign === 'center' ? 'solid' : 'outline'"
                icon="lucide:align-center" class="flex-1" @click="updateTextSettings({ textAlign: 'center' })" />
              <UButton :variant="localTextSettings.textAlign === 'right' ? 'solid' : 'outline'"
                icon="lucide:align-right" class="flex-1" @click="updateTextSettings({ textAlign: 'right' })" />
            </section>
          </div>
        </div>

        <!-- FILL (Shape/Text) -->
        <div v-if="!isNoSelection && !isImageLayerActive">
          <hr class="border-gray-100 dark:border-gray-800 my-4" />
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Fill</h3>
          <div class="relative w-full h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
            <input type="color" v-model="objectFill"
              class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
              @input="handleObjectFillUpdate" data-testid="input-fill" />
          </div>
        </div>

        <!-- STROKE -->
        <div v-if="!isNoSelection && !isTextLayerActive">
          <hr class="border-gray-100 dark:border-gray-800 my-4" />
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Stroke</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <div class="relative w-8 h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                <input type="color" v-model="stroke.color"
                  class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                  @input="handleStrokeUpdate" />
              </div>
              <div class="flex items-center gap-1 w-16">
                <UInput v-model.number="stroke.width" type="number" size="xs" class="text-right"
                  @change="handleStrokeUpdate" data-testid="input-stroke-width" />
                <span class="text-[10px] text-gray-400">px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- EFFECTS (Shadow) -->
        <div v-if="!isNoSelection">
          <hr class="border-gray-100 dark:border-gray-800 my-4" />
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Effects</h3>
            <UButton size="xs" variant="ghost" icon="lucide:plus"
              @click="shadow.enabled = !shadow.enabled; handleShadowUpdate()" data-testid="add-shadow" />
          </div>

          <div v-if="shadow.enabled" class="space-y-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <div class="flex justify-between items-center">
              <span class="text-xs">Shadow</span>
              <USwitch size="xs" v-model="shadow.enabled" @update:model-value="handleShadowUpdate" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UInput v-model.number="shadow.offsetX" size="xs" placeholder="X" @change="handleShadowUpdate" />
              <UInput v-model.number="shadow.offsetY" size="xs" placeholder="Y" @change="handleShadowUpdate" />
              <UInput v-model.number="shadow.blur" size="xs" placeholder="Blur" @change="handleShadowUpdate" />
              <div class="relative w-full h-8 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <input type="color" v-model="shadow.color"
                  class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                  @input="handleShadowUpdate" />
              </div>
            </div>
          </div>
        </div>

        <!-- AI TOOLS -->
        <div v-if="isImageLayerActive">
          <hr class="border-gray-100 dark:border-gray-800 my-4" />
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">AI Tools</h3>
          <UButton block variant="soft" icon="lucide:sparkles"
            :loading="status === 'loading' || status === 'processing'" @click="triggerRemoveBackground()">
            Remove Background
          </UButton>
        </div>

        <!-- IMAGE FILTERS -->
        <div v-if="isImageLayerActive">
          <hr class="border-gray-100 dark:border-gray-800 my-4" />

          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Filters</h3>

          <div class="space-y-4">
            <USelect v-model="presetFilter" :options="['None', 'Grayscale', 'Sepia', 'Contrast']" size="xs"
              @change="editor?.value?.applyPresetFilter?.(presetFilter)" />

            <div v-for="(val, name) in filtersRef" :key="name">
              <div class="flex justify-between mb-1">
                <label class="text-[10px] text-gray-500">{{ name }}</label>
              </div>
              <USlider v-model="(filtersRef as any)[name]" :min="-100" :max="100" size="xs"
                @update:model-value="handleFilterUpdate(name)" />
            </div>
          </div>
        </div>


        <!-- CANVAS BACKGROUND (No selection) -->
        <div v-if="isNoSelection">
          <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Canvas</h3>

          <div class="space-y-4">
            <!-- CANVAS RESIZE -->
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs">Size</span>
              </div>
              <div class="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label class="text-[10px] text-gray-500 block mb-1">W</label>
                  <UInput :model-value="editor?.value?.globalSettings?.value?.width" type="number" size="xs"
                    @change="(v) => editor?.value?.setSize(Number(v), editor?.value?.globalSettings.value.height)" />
                </div>
                <div>
                  <label class="text-[10px] text-gray-500 block mb-1">H</label>
                  <UInput :model-value="editor?.value?.globalSettings?.value?.height" type="number" size="xs"
                    @change="(v) => editor?.value?.setSize(editor?.value?.globalSettings.value.width, Number(v))" />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-1">
                <UButton size="xs" variant="outline" class="text-[10px] px-1"
                  @click="editor.value?.setSize(1080, 1080)">
                  IG Post</UButton>
                <UButton size="xs" variant="outline" class="text-[10px] px-1"
                  @click="editor.value?.setSize(1080, 1920)">
                  Story</UButton>
                <UButton size="xs" variant="outline" class="text-[10px] px-1"
                  @click="editor.value?.setSize(1920, 1080)">
                  Full HD</UButton>
              </div>
            </div>

            <hr class="border-gray-100 dark:border-gray-800" />
            <!-- RULERS -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-xs">Rulers</span>
                <USwitch v-model="showRulers" size="xs" @update:model-value="editor.value?.toggleRulers?.(showRulers)"
                  data-testid="toggle-rulers" />
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs">Snap to Guides</span>
                <USwitch v-model="snapToGuides" size="xs"
                  @update:model-value="editor.value?.toggleGuidelineSnap?.(snapToGuides)" />
              </div>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" class="flex-1" @click="handleAddGuideline('horizontal')">+ H Guide
                </UButton>
                <UButton size="xs" variant="outline" class="flex-1" @click="handleAddGuideline('vertical')">+ V Guide
                </UButton>
              </div>
            </div>

            <hr class="border-gray-100 dark:border-gray-800" />

            <div>
              <label class="text-[10px] text-gray-500 block mb-1">Color</label>
              <div class="flex gap-2 items-center">
                <USelect v-model="background.type" :options="['none', 'solid', 'gradient']" size="xs" class="flex-1"
                  @change="handleBackgroundUpdate" data-testid="select-bg-type" />

                <div v-if="background.type === 'solid'"
                  class="relative w-8 h-8 rounded overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
                  <input type="color" v-model="background.solidColor"
                    class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                    @input="handleBackgroundUpdate" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div v-if="activeTab === 'export'" class="flex flex-col h-full justify-center items-center text-center p-4">
        <Icon name="lucide:image" class="w-12 h-12 text-gray-300 mb-4" />
        <p class="text-sm text-gray-500 mb-4">Export your creation to share it with the world.</p>
        <UButton color="primary" block @click="editor?.downloadCanvasImage()">Download PNG</UButton>
      </div>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 4px;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #374151;
}
</style>
