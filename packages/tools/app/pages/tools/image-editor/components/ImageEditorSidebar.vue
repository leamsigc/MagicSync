<i18n src="../ImageEditor.json"></i18n>

<script lang="ts" setup>
import { useFabricJs } from '../composables/useFabricJs';
import type { TabsItem } from '@nuxt/ui';
import { ref, computed, nextTick } from 'vue';

const { t } = useI18n();
const {
  editor,
} = useFabricJs();

// --- STATE ---
const activeTab = ref('layers'); // Default to layers

// --- LAYERS LOGIC ---
const layers = ref<any[]>([]);

const updateLayers = () => {
  layers.value = editor.value && (editor.value as any).getLayers ? [...(editor.value as any).getLayers()] : [];
};

// Reversed layers to show top layer first (visual stacking order)
const reversedLayers = computed(() => [...layers.value].reverse());
const activeLayer = computed(() => editor?.value?.activeLayer?.value);

const handleLayerClick = (layer: any) => {
  if (editor?.value && editor?.value.fabricCanvas) {
    editor.value.fabricCanvas.setActiveObject(layer);
    editor.value.fabricCanvas.requestRenderAll();
  }
};

const handleDeleteLayer = (layer: any) => {
  // @ts-ignore
  editor.value?.deleteLayer?.(layer);
  editor.value?.fabricCanvas?.requestRenderAll();
  updateLayers();
};

const handleToggleVisibility = (layer: any) => {
  const currentVisibility = layer.visible !== false;

  // @ts-ignore
  editor.value?.toggleLayerVisibility?.(layer, !currentVisibility);
  updateLayers();
};

const moveLayerUp = (layer: any) => {
  // @ts-ignore
  editor.value?.arrangeFront?.(layer);
  updateLayers();
};

const moveLayerDown = (layer: any) => {
  // @ts-ignore
  editor.value?.arrangeBack?.(layer);
  updateLayers();
};

const getLayerType = (layer: any) => {
  if (layer.type === 'image') return 'Image';
  if (layer.type === 'i-text' || layer.type === 'text') return 'Text';
  if (layer.type === 'rect') return 'Rectangle';
  if (layer.type === 'circle') return 'Circle';
  if (layer.type === 'triangle') return 'Triangle';
  if (layer.type === 'path') return 'Drawing';
  return layer.type || 'Object';
};

const getLayerIcon = (layer: any) => {
  if (layer.type === 'image') return "lucide:image";
  if (layer.type === 'i-text' || layer.type === 'text') return "lucide:type";
  if (layer.type === 'rect') return "lucide:square";
  if (layer.type === 'circle') return "lucide:circle";
  if (layer.type === 'triangle') return "lucide:triangle";
  if (layer.type === 'path') return "lucide:pencil";
  return "lucide:box";
};

// Watch for changes in canvas to update layers
// Note: In a real app we might want a better event system
watch(() => editor.value?.state.value, (val) => {
  if (editor.value?.fabricCanvas) {
    const canvas = editor.value.fabricCanvas;
    // Initial load
    updateLayers();
    // Hook into fabric events
    canvas.off('object:added', updateLayers); // avoid duplicates
    canvas.off('object:removed', updateLayers);
    canvas.off('object:modified', updateLayers);

    canvas.on('object:added', updateLayers);
    canvas.on('object:removed', updateLayers);
    canvas.on('object:modified', updateLayers);
  }
}, { immediate: true });


// --- TEMPLATES LOGIC ---
// Hardcoded JSON from previous component
const templateJson = `
{
	"version": "6.7.1",
	"objects": [
		{
			"type": "Rect",
			"originX": "left",
			"originY": "top",
			"left": 0,
			"top": 0,
			"width": 1242,
			"height": 1660,
			"fill": "white",
			"selectable": false
		},
		{
			"type": "i-text",
			"originX": "left",
			"originY": "top",
            "left": 100,
            "top": 100,
            "width": 300,
            "height": 50,
            "fill": "#333",
            "text": "Hello World",
            "fontSize": 60,
            "fontFamily": "Arial"
		}
	],
	"background": "#f3f3f3"
}
`;

// Simple example templates
const templates = [
  { title: 'Poster Simple', description: 'A basic white poster', json: templateJson },
  // Add more real templates here
];

const loadTemplate = (jsonStr: string) => {
  editor.value?.loadTemplateFromJson?.(jsonStr);
  updateLayers();
};


// --- UPLOAD LOGIC ---
const onFileSelect = (files: FileList) => {
  if (files.length > 0) {
    editor.value?.addImageLayer?.(files[0]);
    updateLayers();
  }
}
const fileInput = ref<HTMLInputElement>();

// --- TABS CONFIG ---
const tabs = [
  { id: 'templates', icon: 'lucide:layout-template', label: 'Templates' },
  { id: 'elements', icon: 'lucide:shapes', label: 'Elements' },
  { id: 'text', icon: 'lucide:type', label: 'Text' },
  { id: 'uploads', icon: 'lucide:upload', label: 'Uploads' },
  { id: 'layers', icon: 'lucide:layers', label: 'Layers' },
];

const HandleAddTextLayer = ({ text = 'Add a heading', fontSize = 32, fontWeight = 'bold' }: { text?: string, fontSize?: number, fontWeight?: string }) => {
  editor.value?.stopDrawingMode?.();
  editor.value?.addTextLayer?.(text, { fontSize, fontWeight });
}
const selectTab = (id: string) => {
  activeTab.value = id;
  editor.value?.stopDrawingMode?.();
}
const HandleAddShapeLayer = (type: string, options: any) => {
  editor.value?.stopDrawingMode?.();
  editor.value?.addShapeLayer?.(type, options);
}
const HandleAddBrushLayer = () => {
  editor.value?.stopDrawingMode?.();
  editor.value?.addBrushLayer?.('black', 5)
}
</script>

<template>
  <div class="h-full flex flex-row border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-[360px]">

    <!-- Icon Strip -->
    <div
      class="w-16 flex flex-col items-center py-4 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 gap-4">
      <template v-for="tab in tabs" :key="tab.id">
        <UTooltip :text="tab.label" placement="right">
          <button class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
            :class="activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'"
            @click="selectTab(tab.id)" :data-testid="`tab-${tab.id}`">
            <Icon :name="tab.icon" class="w-5 h-5" />
          </button>
        </UTooltip>
      </template>
    </div>

    <!-- Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center px-4">
        <h2 class="font-semibold text-sm capitalize">{{ activeTab }}</h2>
      </header>

      <div class="flex-1 overflow-y-auto p-4 thin-scrollbar">

        <!-- TEMPLATES TAB -->
        <div v-if="activeTab === 'templates'" class="space-y-4">
          <div v-for="(tpl, idx) in templates" :key="idx"
            class="border border-gray-200 dark:border-gray-800 rounded-lg p-2 hover:border-primary cursor-pointer transition-colors"
            @click="loadTemplate(tpl.json)">
            <div class="aspect-3/4 bg-gray-100 dark:bg-gray-800 rounded-md mb-2 flex items-center justify-center">
              <Icon name="lucide:layout-template" class="w-8 h-8 text-gray-400" />
            </div>
            <div class="text-xs font-medium">{{ tpl.title }}</div>
            <div class="text-[10px] text-gray-500">{{ tpl.description }}</div>
          </div>
        </div>

        <!-- ELEMENTS TAB -->
        <div v-if="activeTab === 'elements'" class="space-y-6">
          <div>
            <h3 class="text-xs font-semibold text-gray-500 mb-3 uppercase">Basic Shapes</h3>
            <div class="grid grid-cols-3 gap-3">
              <UButton
                class="aspect-square border border-gray-200 dark:border-gray-800 rounded flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600"
                @click="HandleAddShapeLayer('rect', { fill: '#333' })" data-testid="add-rect" variant="ghost">
                <Icon name="lucide:square" class="w-6 h-6 mb-1" />
                <span class="text-[10px]">Rect</span>
              </UButton>
              <UButton
                class="aspect-square border border-gray-200 dark:border-gray-800 rounded flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600"
                @click="HandleAddShapeLayer('circle', { fill: '#333' })" variant="ghost" data-testid="add-circle">
                <Icon name="lucide:circle" class="w-6 h-6 mb-1" />
                <span class="text-[10px]">Circle</span>
              </UButton>
              <UButton
                class="aspect-square border border-gray-200 dark:border-gray-800 rounded flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600"
                @click="HandleAddShapeLayer('triangle', { fill: '#333' })" data-testid="add-triangle" variant="ghost">
                <Icon name="lucide:triangle" class="w-6 h-6 mb-1" />
                <span class="text-[10px]">Triangle</span>
              </UButton>
            </div>
          </div>

          <div>
            <h3 class="text-xs font-semibold text-gray-500 mb-3 uppercase">Drawing</h3>
            <UButton block variant="outline" icon="lucide:pencil" @click="HandleAddBrushLayer">
              Enable Brush
            </UButton>
          </div>
        </div>

        <!-- TEXT TAB -->
        <div v-if="activeTab === 'text'" class="space-y-4">
          <UButton block size="lg" color="neutral" variant="soft"
            @click="HandleAddTextLayer({ text: 'Add a heading', fontSize: 32, fontWeight: 'bold' })">
            Add a heading
          </UButton>
          <UButton block size="md" color="neutral" variant="soft"
            @click="HandleAddTextLayer({ text: 'Add a subheading', fontSize: 24, fontWeight: 'semi-bold' })">
            Add a subheading
          </UButton>
          <UButton block size="sm" color="neutral" variant="soft"
            @click="HandleAddTextLayer({ text: 'Add a little bit of body text', fontSize: 16 })">
            Add body text
          </UButton>
        </div>

        <!-- UPLOADS TAB -->
        <div v-if="activeTab === 'uploads'" class="space-y-4">
          <UButton block icon="lucide:upload" @click="fileInput?.click()">
            Upload Image
          </UButton>
          <input ref="fileInput" type="file" accept="image/*" class="hidden"
            @change="(e) => onFileSelect((e.target as HTMLInputElement).files!)" />

          <div class="text-xs text-center text-gray-500 mt-4">
            Uploaded images will appear here (Not persisted in this demo)
          </div>
        </div>

        <!-- LAYERS TAB -->
        <div v-if="activeTab === 'layers'" class="space-y-2">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-500">{{ reversedLayers.length }} Layers</span>
            <UButton size="xs" variant="ghost" icon="lucide:refresh-ccw" @click="updateLayers" />
          </div>

          <div v-if="reversedLayers.length === 0" class="text-center py-8 text-gray-400 text-sm">
            No layers. Add something!
          </div>

          <div v-for="(layer, index) in reversedLayers" :key="`layer-${index}`"
            class="group flex items-center gap-2 p-2 rounded-md cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
            :class="{ 'bg-primary/5 border-primary/20': layer === activeLayer }" @click="handleLayerClick(layer)">

            <UButton class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" variant="ghost"
              @click.stop="handleToggleVisibility(layer)">
              <Icon :name="layer.visible !== false ? 'lucide:eye' : 'lucide:eye-off'" class="w-4 h-4" />
            </UButton>

            <div
              class="w-8 h-8 rounded bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700 shrink-0">
              <Icon :name="getLayerIcon(layer)" class="w-4 h-4 text-gray-500" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium truncate select-none">{{ getLayerType(layer) }}</div>
            </div>

            <div class="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
              <UButton class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" @click.stop="moveLayerUp(layer)"
                variant="ghost">
                <Icon name="lucide:arrow-up" class="w-3 h-3 text-gray-500" />
              </UButton>
              <UButton class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" @click.stop="moveLayerDown(layer)"
                variant="ghost">
                <Icon name="lucide:arrow-down" class="w-3 h-3 text-gray-500" />
              </UButton>
              <UButton class="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                @click.stop="handleDeleteLayer(layer)" variant="ghost">
                <Icon name="lucide:trash-2" class="w-3 h-3" />
              </UButton>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.thin-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.thin-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.thin-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.dark .thin-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
}
</style>
