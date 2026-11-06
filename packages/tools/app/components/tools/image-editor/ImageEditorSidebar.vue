<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs';
import StudioVariablesPanel from './StudioVariablesPanel.vue';
import StudioShapesPanel from './StudioShapesPanel.vue';
import StudioStockPanel from './StudioStockPanel.vue';
import StudioFontsPanel from './StudioFontsPanel.vue';
import StudioTimelinePanel from './StudioTimelinePanel.vue';
import StudioTemplatesPanel from './StudioTemplatesPanel.vue';
import StudioResizePanel from './StudioResizePanel.vue';
import StudioDesignPanel from './StudioDesignPanel.vue';
import StudioColorField from './StudioColorField.vue';
import StudioBackgroundPanel from './StudioBackgroundPanel.vue';

const { t } = useI18n();
const toast = useToast();
const {
  editor,
  sidebarTab: activeTab,
} = useFabricJs();

// --- LAYERS LOGIC ---
const layers = ref<any[]>([]);

const updateLayers = () => {
  const all = editor.value && (editor.value as any).getLayers ? [...(editor.value as any).getLayers()] : [];
  const workspace = all.find((layer: { id?: string }) => layer.id === 'workspace') as { width?: number; height?: number } | undefined;
  const frameWidth = workspace?.width ?? 0;
  const frameHeight = workspace?.height ?? 0;
  const isBackgroundFill = (layer: { type?: string; width?: number; height?: number; visible?: boolean }) =>
    layer.type === 'rect' && layer.visible === false
    && frameWidth > 0 && frameHeight > 0
    && (layer.width ?? 0) >= frameWidth * 0.95 && (layer.height ?? 0) >= frameHeight * 0.95;
  const seen = new Set<string>();
  layers.value = all.filter((layer: { id?: string; type?: string; width?: number; height?: number; visible?: boolean }) => {
    if (layer.id === 'workspace' || layer.id === '__background' || layer.id === '__template-fill') return false;
    if (isBackgroundFill(layer)) return false;
    // Fabric can expose the same instance twice while a group is being edited.
    const key = layer.id || String((layer as { __uid?: string }).__uid ?? '');
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  editor.value?.fabricCanvas?.setActiveObject(layer);
  editor.value?.arrangeFront?.(layer);
  editor.value?.fabricCanvas?.requestRenderAll();
  updateLayers();
};

const moveLayerDown = (layer: any) => {
  editor.value?.fabricCanvas?.setActiveObject(layer);
  editor.value?.arrangeBack?.(layer);
  editor.value?.fabricCanvas?.requestRenderAll();
  updateLayers();
};

const LAYER_KIND_KEYS: Record<string, string> = {
  image: 'panel.layerKind.image',
  video: 'panel.layerKind.video',
  text: 'panel.layerKind.text',
  rect: 'panel.layerKind.rect',
  circle: 'panel.layerKind.circle',
  triangle: 'panel.layerKind.triangle',
  path: 'panel.layerKind.path',
};
const LAYER_ICONS: Record<string, string> = {
  image: 'lucide:image',
  video: 'lucide:film',
  text: 'lucide:type',
  rect: 'lucide:square',
  circle: 'lucide:circle',
  triangle: 'lucide:triangle',
  path: 'lucide:pencil',
};

const normalizeLayerKind = (type: string | undefined, videoUrl?: string) => {
  if (videoUrl) return 'video';
  if (!type) return 'object';
  if (type === 'i-text' || type === 'itext' || type === 'textbox' || type === 'text') return 'text';
  if (type === 'group' || type === 'activeSelection') return 'object';
  return type;
};

/** Prefer the layer's variable/name label over the raw type. */
const getLayerType = (layer: { type?: string; name?: string }) => {
  const named = typeof layer.name === 'string' ? layer.name.trim() : '';
  if (named) return named.replace(/^\{|\}$/g, '');
  return t(LAYER_KIND_KEYS[normalizeLayerKind(layer.type, layer.videoUrl)] ?? 'panel.layerKind.object');
};

const getLayerIcon = (layer: any) => LAYER_ICONS[normalizeLayerKind(layer.type, layer.videoUrl)] ?? 'lucide:box';

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


// --- STUDIO PANELS (visible per tab; registered below) ---
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



// --- TABS CONFIG ---
const tabs = [
  { id: 'layers', icon: 'lucide:layers', labelKey: 'rail.layers' },
  { id: 'elements', icon: 'lucide:shapes', labelKey: 'rail.shapes' },
  { id: 'text', icon: 'lucide:type', labelKey: 'rail.text' },
  { id: 'uploads', icon: 'lucide:upload', labelKey: 'rail.uploads' },
  { id: 'background', icon: 'lucide:wallpaper', labelKey: 'rail.background' },
  { id: 'templates', icon: 'lucide:layout-template', labelKey: 'rail.templates' },
  { id: 'variables', icon: 'lucide:braces', labelKey: 'rail.variables' },
  { id: 'stock', icon: 'lucide:image', labelKey: 'rail.stock' },
  { id: 'fonts', icon: 'lucide:case-sensitive', labelKey: 'rail.fonts' },
  { id: 'timeline', icon: 'lucide:film', labelKey: 'rail.timeline' },
  { id: 'resize', icon: 'lucide:ruler', labelKey: 'rail.resize' },
  { id: 'designs', icon: 'lucide:swatch-book', labelKey: 'rail.designs' },
];

const RAIL_GROUPS: Array<{ id: string; items: string[] }> = [
  { id: 'create', items: ['templates', 'elements', 'text', 'uploads', 'background'] },
  { id: 'studio', items: ['stock', 'fonts', 'variables', 'resize', 'timeline'] },
  { id: 'manage', items: ['layers', 'designs'] },
]

const tabById = (id: string) => tabs.find(tab => tab.id === id)
const panelCollapsed = ref(false)
const togglePanel = () => {
  panelCollapsed.value = !panelCollapsed.value
}

const STUDIO_PANEL_TITLES: Record<string, string> = {
  background: 'panel.backgroundTitle',
  variables: 'panel.variablesTitle',
  stock: 'panel.stockTitle',
  fonts: 'panel.fontsTitle',
  timeline: 'panel.timelineTitle',
  resize: 'panel.resizeTitle',
  designs: 'panel.designsTitle',
};

const panelTitle = computed(() => {
  if (activeTab.value === 'layers') return t('panel.layersTitle');
  if (activeTab.value === 'elements') return t('panel.shapesTitle');
  if (activeTab.value === 'text') return t('panel.textTitle');
  if (activeTab.value === 'uploads') return t('panel.uploadsTitle');
  if (activeTab.value === 'templates') return t('panel.templatesTitle');
  const studio = STUDIO_PANEL_TITLES[activeTab.value];
  return studio ? t(studio) : t('panel.layersTitle');
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
  panelCollapsed.value = false;
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
</script>

<template>
  <aside
    class="h-full flex flex-row border-r border-default bg-default shrink-0 transition-[width] duration-200"
    :class="panelCollapsed ? 'w-[76px]' : 'w-[76px] sm:w-[340px]'">

    <!-- Icon rail with labels (Polotno-style) -->
    <nav
      class="w-[76px] shrink-0 flex flex-col items-center gap-0.5 border-r border-default bg-muted/40 py-2 overflow-y-auto"
      :aria-label="t('rail.label')">
      <UTooltip :text="t('rail.select')" placement="right">
        <UButton
          color="neutral" variant="ghost"
          class="flex-col gap-1 h-auto w-[60px] py-1.5 px-1 rounded-lg"
          :aria-label="t('rail.select')"
          data-testid="tool-select" @click="HandleSelectTool">
          <Icon name="lucide:mouse-pointer-2" class="size-[18px]" />
          <span class="text-[9px] leading-none">{{ t('rail.select') }}</span>
        </UButton>
      </UTooltip>

      <template v-for="group in RAIL_GROUPS" :key="group.id">
        <div class="h-px w-10 my-1 bg-accented" aria-hidden="true" />
        <UTooltip
          v-for="id in group.items" :key="id"
          :text="t(tabById(id)?.labelKey ?? id)" placement="right">
          <UButton
            :color="activeTab === id ? 'primary' : 'neutral'"
            :variant="activeTab === id ? 'soft' : 'ghost'"
            class="flex-col gap-1 h-auto w-[60px] py-1.5 px-1 rounded-lg"
            :aria-label="t(tabById(id)?.labelKey ?? id)"
            :data-testid="`tab-${id}`" @click="selectTab(id)">
            <Icon :name="tabById(id)?.icon ?? 'lucide:square'" class="size-[18px]" />
            <span class="text-[9px] leading-none w-full text-center truncate">{{ t(tabById(id)?.labelKey ?? id) }}</span>
          </UButton>
        </UTooltip>
      </template>
    </nav>

    <!-- Contextual panel -->
    <div v-show="!panelCollapsed" class="flex-1 flex flex-col min-w-0">
      <header class="h-12 border-b border-default flex items-center gap-2 px-3 shrink-0">
        <h2 class="font-semibold text-sm truncate flex-1">{{ panelTitle }}</h2>
        <UButton
          color="neutral" variant="ghost" size="xs" icon="lucide:panel-left-close"
          :aria-label="t('rail.collapse')" @click="togglePanel" />
      </header>

      <div class="flex-1 overflow-y-auto p-3">

        <!-- TEMPLATES TAB (public library + JSON import) -->
        <div v-if="activeTab === 'templates'" v-motion-fade-visible :duration="200">
          <StudioTemplatesPanel />
        </div>

        <!-- BACKGROUND TAB (colors, Unsplash backgrounds, gradients) -->
        <div v-if="activeTab === 'background'" v-motion-fade-visible :duration="200">
          <StudioBackgroundPanel />
        </div>

        <!-- VARIABLES TAB ({name} bindings + live apply) -->
        <div v-if="activeTab === 'variables'" v-motion-fade-visible :duration="200">
          <StudioVariablesPanel />
        </div>

        <!-- STOCK TAB (Pexels / Unsplash / Pexels video) -->
        <div v-if="activeTab === 'stock'" v-motion-fade-visible :duration="200">
          <StudioStockPanel />
        </div>

        <!-- FONTS TAB (bundled families + pairs) -->
        <div v-if="activeTab === 'fonts'" v-motion-fade-visible :duration="200">
          <StudioFontsPanel />
        </div>

        <!-- TIMELINE TAB (animations + transitions + playback) -->
        <div v-if="activeTab === 'timeline'" v-motion-fade-visible :duration="200">
          <StudioTimelinePanel />
        </div>

        <!-- RESIZE TAB (catalog + custom size) -->
        <div v-if="activeTab === 'resize'" v-motion-fade-visible :duration="200">
          <StudioResizePanel />
        </div>

        <!-- DESIGNS TAB (save / versions / brand kits / my designs) -->
        <div v-if="activeTab === 'designs'" v-motion-fade-visible :duration="200">
          <StudioDesignPanel />
        </div>

        <!-- ELEMENTS TAB -->
        <div v-if="activeTab === 'elements'" v-motion-fade-visible :duration="200" class="space-y-5">
          <StudioShapesPanel />

          <div>
            <h3 class="text-[11px] font-semibold text-dimmed mb-2 uppercase tracking-wider">{{ t('panel.drawingTitle') }}</h3>
            <div class="space-y-3 rounded-xl border border-default bg-elevated/50 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-toned">{{ t('panel.brushColor') }}</span>
                <StudioColorField v-model="brushColor" />
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
            v-for="layer in reversedLayers" :key="(layer as any).id ?? (layer as any).__uid ?? layer"
            :data-layer-id="(layer as any).id ?? ''"
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
  </aside>
</template>
