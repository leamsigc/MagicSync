<i18n src="../ImageEditor.json"></i18n>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useFabricJs } from '../composables/useFabricJs';

const { t } = useI18n();
const toast = useToast();
const {
  editor,
} = useFabricJs();

// --- STATE ---
const activeTab = ref('layers'); // layers | shapes-alias(elements) | text | uploads | templates

// --- LAYERS LOGIC ---
const layers = ref<any[]>([]);

const updateLayers = () => {
  layers.value = editor.value && (editor.value as any).getLayers ? [...(editor.value as any).getLayers()] : [];
};

// Reversed layers to show top layer first (visual stacking order)
const reversedLayers = computed(() => [...layers.value].reverse());
const layerCountLabel = computed(() => reversedLayers.value.length === 1
  ? t('panel.layerSingle')
  : t('panel.layersCount', { count: reversedLayers.value.length }));
const activeLayer = computed(() => editor?.value?.activeLayer?.value);

const handleLayerClick = (layer: any) => {
  if (editor?.value && editor?.value.fabricCanvas) {
    editor.value.fabricCanvas.setActiveObject(layer);
    editor.value.fabricCanvas.requestRenderAll();
  }
};

const handleDeleteLayer = (layer: any) => {
  editor.value?.deleteLayer?.(layer);
  editor.value?.fabricCanvas?.requestRenderAll();
  updateLayers();
};

const handleToggleVisibility = (layer: any) => {
  const currentVisibility = layer.visible !== false;

  editor.value?.toggleLayerVisibility?.(layer, !currentVisibility);
  updateLayers();
};

const moveLayerUp = (layer: any) => {
  editor.value?.arrangeFront?.(layer);
  updateLayers();
};

const moveLayerDown = (layer: any) => {
  editor.value?.arrangeBack?.(layer);
  updateLayers();
};

const LAYER_KIND_KEYS: Record<string, string> = {
  image: 'panel.layerKind.image',
  text: 'panel.layerKind.text',
  rect: 'panel.layerKind.rect',
  circle: 'panel.layerKind.circle',
  triangle: 'panel.layerKind.triangle',
  path: 'panel.layerKind.path',
};
const LAYER_ICONS: Record<string, string> = {
  image: 'lucide:image',
  text: 'lucide:type',
  rect: 'lucide:square',
  circle: 'lucide:circle',
  triangle: 'lucide:triangle',
  path: 'lucide:pencil',
};

const normalizeLayerKind = (type: string | undefined) => {
  if (type === 'i-text') return 'text';
  return type ?? 'object';
};

const getLayerType = (layer: any) => t(LAYER_KIND_KEYS[normalizeLayerKind(layer.type)] ?? 'panel.layerKind.object');

const getLayerIcon = (layer: any) => LAYER_ICONS[normalizeLayerKind(layer.type)] ?? 'lucide:box';

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
const templates = ref([
  { title: 'Poster Simple', description: 'A basic white poster', json: templateJson },
  // Add more real templates here
]);

const loadTemplate = (jsonStr: string) => {
  editor.value?.loadTemplateFromJson?.(jsonStr);
  updateLayers();
};


// --- UPLOAD LOGIC ---
const handleUploadFiles = (files: File | File[] | undefined) => {
  const list = normalizeUploadFiles(files);
  if (list.length === 0) {
    toast.add({ title: t('panel.uploadsInvalid'), color: 'warning', icon: 'i-heroicons-exclamation-triangle' });
    return;
  }
  list.forEach(addUploadLayer);
  updateLayers();
};

const normalizeUploadFiles = (files: File | File[] | undefined): File[] => {
  if (!files) return [];
  const list = Array.isArray(files) ? files : [files];
  return list.filter(isImageFile);
};

const isImageFile = (file: File) => file.type.startsWith('image/');

const addUploadLayer = (file: File) => {
  editor.value?.addImageLayer?.(file);
};
const onTemplateSelect = async (files: FileList) => {
  if (files.length > 0) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      templates.value.push({ title: t('panel.templateCustom'), description: 'Uploaded template', json: e.target.result });
    }
    await reader.readAsText(files[0] as Blob);
  }
};
const templateInput = ref<HTMLInputElement>();



// --- TABS CONFIG ---
const tabs = [
  { id: 'layers', icon: 'lucide:layers', labelKey: 'rail.layers' },
  { id: 'elements', icon: 'lucide:shapes', labelKey: 'rail.shapes' },
  { id: 'text', icon: 'lucide:type', labelKey: 'rail.text' },
  { id: 'uploads', icon: 'lucide:upload', labelKey: 'rail.uploads' },
  { id: 'templates', icon: 'lucide:layout-template', labelKey: 'rail.templates' },
];

const panelTitle = computed(() => {
  if (activeTab.value === 'layers') return t('panel.layersTitle');
  if (activeTab.value === 'elements') return t('panel.shapesTitle');
  if (activeTab.value === 'text') return t('panel.textTitle');
  if (activeTab.value === 'uploads') return t('panel.uploadsTitle');
  return t('panel.templatesTitle');
});

// --- BRUSH STATE ---
const brushColor = ref('#000000');
const brushWidth = ref(5);

const HandleAddTextLayer = ({ text = 'Add a heading', fontSize = 32, fontWeight = 'bold' }: { text?: string, fontSize?: number, fontWeight?: string }) => {
  editor.value?.stopDrawingMode?.();
  editor.value?.addTextLayer?.(text, { fontSize, fontWeight });
}
const selectTab = (id: string) => {
  activeTab.value = id;
  editor.value?.stopDrawingMode?.();
}
const HandleSelectTool = () => {
  editor.value?.stopDrawingMode?.();
  editor.value?.selectLayer?.();
  activeTab.value = 'layers';
}
const HandleAddShapeLayer = (type: string, options: any) => {
  editor.value?.stopDrawingMode?.();
  editor.value?.addShapeLayer?.(type, options);
}
const HandleAddBrushLayer = () => {
  editor.value?.stopDrawingMode?.();
  editor.value?.addBrushLayer?.(brushColor.value, brushWidth.value)
}
const handleUploadTemplateClick = () => {
  templateInput.value?.click();
}
const handleTemplateFileChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files) onTemplateSelect(files);
}
</script>

<template>
  <div class="h-full flex flex-row border-r border-default bg-default w-[300px]">

    <!-- Icon rail -->
    <div
      class="w-14 flex flex-col items-center py-3 border-r border-default bg-muted/50 gap-1.5">
      <UTooltip :text="t('rail.select')" placement="right">
        <UButton
          color="neutral" variant="ghost"
          icon="lucide:mouse-pointer-2"
          :aria-label="t('rail.select')"
          data-testid="tool-select" @click="HandleSelectTool" />
      </UTooltip>
      <div class="h-px w-8 bg-accented my-1" aria-hidden="true" />
      <template v-for="tab in tabs" :key="tab.id">
        <UTooltip :text="t(tab.labelKey)" placement="right">
          <UButton
            :color="activeTab === tab.id ? 'primary' : 'neutral'"
            :variant="activeTab === tab.id ? 'soft' : 'ghost'"
            :icon="tab.icon"
            :aria-label="t(tab.labelKey)"
            :data-testid="`tab-${tab.id}`" @click="selectTab(tab.id)" />
        </UTooltip>
      </template>
    </div>

    <!-- Contextual panel -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-12 border-b border-default flex items-center px-3 shrink-0">
        <h2 class="font-semibold text-sm">{{ panelTitle }}</h2>
      </header>

      <div class="flex-1 overflow-y-auto p-3">

        <!-- TEMPLATES TAB -->
        <div v-if="activeTab === 'templates'" v-motion-fade-visible :duration="200" class="space-y-3">
          <section>
            <UButton block icon="lucide:upload" variant="outline" @click="handleUploadTemplateClick">
              {{ t('panel.templatesUpload') }}
            </UButton>
            <input
              ref="templateInput" type="file" accept='application/json' class="hidden"
              @change="handleTemplateFileChange" >

            <div class="text-xs text-center text-muted mt-3">
              {{ t('panel.templatesHint') }}
            </div>
          </section>
          <div
            v-for="(tpl, idx) in templates" :key="idx"
            class="border border-default rounded-xl p-2 hover:border-primary cursor-pointer transition-colors bg-elevated/50"
            @click="loadTemplate(tpl.json)">
            <div class="aspect-3/4 bg-muted rounded-lg mb-2 flex items-center justify-center">
              <Icon name="lucide:layout-template" class="w-8 h-8 text-dimmed" />
            </div>
            <div class="text-xs font-medium">{{ tpl.title }}</div>
            <div class="text-[11px] text-muted">{{ tpl.description }}</div>
          </div>
        </div>

        <!-- ELEMENTS TAB -->
        <div v-if="activeTab === 'elements'" v-motion-fade-visible :duration="200" class="space-y-5">
          <div>
            <h3 class="text-[11px] font-semibold text-dimmed mb-2 uppercase tracking-wider">{{ t('panel.shapesBasic') }}</h3>
            <div class="grid grid-cols-3 gap-2">
              <UButton
                variant="outline" data-testid="add-rect"
                class="aspect-square flex-col gap-1 h-auto py-3" @click="HandleAddShapeLayer('rect', { fill: '#333' })">
                <Icon name="lucide:square" class="w-5 h-5" />
                <span class="text-[10px]">{{ t('panel.rect') }}</span>
              </UButton>
              <UButton
                variant="outline" data-testid="add-circle"
                class="aspect-square flex-col gap-1 h-auto py-3" @click="HandleAddShapeLayer('circle', { fill: '#333' })">
                <Icon name="lucide:circle" class="w-5 h-5" />
                <span class="text-[10px]">{{ t('panel.circle') }}</span>
              </UButton>
              <UButton
                variant="outline" data-testid="add-triangle"
                class="aspect-square flex-col gap-1 h-auto py-3" @click="HandleAddShapeLayer('triangle', { fill: '#333' })">
                <Icon name="lucide:triangle" class="w-5 h-5" />
                <span class="text-[10px]">{{ t('panel.triangle') }}</span>
              </UButton>
            </div>
          </div>

          <div>
            <h3 class="text-[11px] font-semibold text-dimmed mb-2 uppercase tracking-wider">{{ t('panel.drawingTitle') }}</h3>
            <div class="space-y-3 rounded-xl border border-default bg-elevated/50 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-toned">{{ t('panel.brushColor') }}</span>
                <UColorPicker v-model="brushColor" />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-toned">{{ t('panel.brushWidth') }}</span>
                  <span class="text-xs font-mono text-muted">{{ brushWidth }}px</span>
                </div>
                <USlider v-model="brushWidth" :min="1" :max="50" size="xs" />
              </div>
              <UButton block variant="soft" icon="lucide:pencil" @click="HandleAddBrushLayer">
                {{ t('rail.draw') }}
              </UButton>
            </div>
          </div>
        </div>

        <!-- TEXT TAB -->
        <div v-if="activeTab === 'text'" v-motion-fade-visible :duration="200" class="space-y-2">
          <UButton
            block size="lg" color="neutral" variant="soft"
            @click="HandleAddTextLayer({ text: 'Add a heading', fontSize: 32, fontWeight: 'bold' })">
            {{ t('panel.heading') }}
          </UButton>
          <UButton
            block size="md" color="neutral" variant="soft"
            @click="HandleAddTextLayer({ text: 'Add a subheading', fontSize: 24, fontWeight: 'semi-bold' })">
            {{ t('panel.subheading') }}
          </UButton>
          <UButton
            block size="sm" color="neutral" variant="soft"
            @click="HandleAddTextLayer({ text: 'Add a little bit of body text', fontSize: 16 })">
            {{ t('panel.body') }}
          </UButton>
        </div>

        <!-- UPLOADS TAB -->
        <div v-if="activeTab === 'uploads'" v-motion-fade-visible :duration="200" class="space-y-3">
          <UFileUpload
            accept="image/*" :multiple="true" class="min-h-48"
            :label="t('panel.uploadsTitle')" :description="t('panel.uploadsHint')"
            @update:model-value="handleUploadFiles" />

          <div class="text-xs text-center text-muted">
            {{ t('panel.uploadsHint') }}
          </div>
        </div>

        <!-- LAYERS TAB -->
        <div v-if="activeTab === 'layers'" v-motion-fade-visible :duration="200" class="space-y-1.5">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs text-muted">{{ layerCountLabel }}</span>
            <UButton size="xs" variant="ghost" color="neutral" icon="lucide:refresh-ccw" :aria-label="t('panel.layersTitle')" @click="updateLayers" />
          </div>

          <div v-if="reversedLayers.length === 0" class="text-center py-8 text-muted text-sm">
            {{ t('panel.layersEmpty') }}
          </div>

          <div
            v-for="(layer, index) in reversedLayers" :key="`layer-${index}`"
            class="group flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer border transition-colors"
            :class="layer === activeLayer ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:border-default hover:bg-elevated'" @click="handleLayerClick(layer)">

            <UButton
              variant="ghost" color="neutral" size="xs"
              :icon="layer.visible !== false ? 'lucide:eye' : 'lucide:eye-off'"
              :aria-label="t('panel.layersTitle')"
              @click.stop="handleToggleVisibility(layer)">
            </UButton>

            <div
              class="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center border border-default shrink-0">
              <Icon :name="getLayerIcon(layer)" class="w-4 h-4 text-muted" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium truncate select-none">{{ getLayerType(layer) }}</div>
            </div>

            <div class="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <UButton
                variant="ghost" color="neutral" size="xs"
                icon="lucide:arrow-up"
                :aria-label="t('section.bringForward')"
                @click.stop="moveLayerUp(layer)">
              </UButton>
              <UButton
                variant="ghost" color="neutral" size="xs"
                icon="lucide:arrow-down"
                :aria-label="t('section.sendBackward')"
                @click.stop="moveLayerDown(layer)">
              </UButton>
              <UButton
                variant="ghost" color="error" size="xs"
                icon="lucide:trash-2"
                :aria-label="t('header.delete')"
                @click.stop="handleDeleteLayer(layer)">
              </UButton>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
