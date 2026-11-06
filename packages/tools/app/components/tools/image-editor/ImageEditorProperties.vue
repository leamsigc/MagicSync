<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>
<script lang="ts" setup>
import { Gradient, type FabricObject } from 'fabric';
import StudioColorField from './StudioColorField.vue';
import { loadGoogleFont } from '../../../../shared/image-editor/google-fonts';
import { computed, watch, ref } from 'vue';
import { BG_BUSY_CODE } from '../../../composables/useImageTransformer';
import { useFabricJs, type BgRemovalOutcome } from '../../../composables/tools/image-editor/useFabricJs';
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio';
import { useDesignMp4Export } from '../../../composables/tools/image-editor/useDesignMp4Export';
import { fileToDataUrl } from '../../../../shared/image-editor/file-to-data-url';
import { replaceImageSource } from '../../../../shared/image-editor/studio-canvas';

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
  bgStatus,
  bgError,
  bgProgress,
  isBgBusy,
  propertiesTab: activeTab,
  setSidebarTab,
} = useFabricJs();

const { start, result, error } = useImageTransformer();


const activeLayer = computed(() => editor?.value?.activeLayer?.value);
const isTextLayerActive = computed(() => activeLayer.value?.type === 'i-text' || activeLayer.value?.type === 'text');
const isImageLayerActive = computed(() => activeLayer.value?.type === 'image');
const isNoSelection = computed(() => !activeLayer.value);
const designStudio = useDesignStudio();
const { exportingMp4, exportMp4 } = useDesignMp4Export();

const handleExportMp4 = () => {
  void exportMp4();
};

// --- REPLACE IMAGE STATE ---
type ReplaceSource = 'upload' | 'url' | 'assets';
const replaceSource = ref<ReplaceSource>('upload');
const replaceUrl = ref('');
const replaceResize = ref(false);
const replacing = ref(false);
const replaceInput = ref<HTMLInputElement | null>(null);
const designAssets = ref<Array<{ name: string; mimeType: string }>>([]);
const assetsLoading = ref(false);
const assetsLoaded = ref(false);
const assetsError = ref(false);

const setReplaceSource = (source: ReplaceSource) => {
  replaceSource.value = source;
  if (source === 'assets') void loadDesignAssets();
};

function triggerReplaceInput() {
  replaceInput.value?.click();
}

function assetUrl(name: string): string {
  return `/api/v1/image-editor/assets/${encodeURIComponent(name)}`;
}

/** Swap the selected layer's bitmap while keeping its position and box. */
async function applyReplacement(src: string | null) {
  const canvas = editor.value?.fabricCanvas;
  const target = canvas?.getActiveObject();
  if (!canvas || !target || !src) return;
  replacing.value = true;
  try {
    await replaceImageSource(target as FabricObject, src, replaceResize.value);
    canvas.requestRenderAll();
    designStudio.markDirty();
    replaceUrl.value = '';
    toast.add({
      title: t('studio.replace.done'),
      description: replaceResize.value ? t('studio.replace.doneResized') : t('studio.replace.doneKept'),
      color: 'success',
      icon: 'lucide:image-up',
    });
  } catch {
    toast.add({ title: t('studio.replace.failed'), color: 'error', icon: 'lucide:x-circle' });
  }
  replacing.value = false;
}

async function handleReplaceUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file).catch(() => '');
  await applyReplacement(dataUrl || null);
  input.value = '';
}

async function applyReplaceUrl() {
  const value = replaceUrl.value.trim();
  if (!/^(https?:\/\/|data:image\/)/i.test(value)) {
    toast.add({ title: t('studio.replace.invalidUrl'), color: 'warning', icon: 'lucide:link-2-off' });
    return;
  }
  await applyReplacement(value);
}

async function loadDesignAssets() {
  if (assetsLoaded.value || assetsLoading.value) return;
  assetsLoading.value = true;
  assetsError.value = false;
  try {
    const response = await $fetch<{ assets: Array<{ name: string; mimeType: string }> }>('/api/v1/image-editor/assets');
    designAssets.value = (response.assets ?? []).filter(asset => asset.mimeType.startsWith('image/')).slice(0, 60);
    assetsLoaded.value = true;
  } catch {
    assetsError.value = true;
  }
  assetsLoading.value = false;
}

async function applyAsset(name: string) {
  await applyReplacement(assetUrl(name));
}

// --- TRANSFORM STATE ---
const position = ref({ x: 0, y: 0 });
const size = ref({ width: 0, height: 0 });
const opacity = ref(100);

// --- APPEARANCE STATE ---
const objectFill = ref('#cccccc');
const fillMode = ref<'solid' | 'gradient'>('solid');
const gradientStart = ref('#c2410c');
const gradientEnd = ref('#f59e0b');
const gradientAngle = ref(45);
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
const localTextSettings = ref<TextAdjustmentProps>({ fontSize: 16, fontFamily: 'Arial', fill: '#000000' });
const textProps = ref({
  letterSpacing: 0,
  lineHeight: 1.16
});

// --- FILTER STATE ---
const presetFilter = ref('None');
const presetFilterItems = computed(() => [
  { label: t('section.presetNone'), value: 'None' },
  { label: t('section.presetGrayscale'), value: 'Grayscale' },
  { label: t('section.presetSepia'), value: 'Sepia' },
  { label: t('section.presetContrast'), value: 'Contrast' },
]);
const filtersRef = ref({
  Brightness: 0,
  Contrast: 0,
  Saturation: 0,
  Hue: 0,
  Blur: 0,
});
const adjustmentLabelKeys: Record<string, string> = {
  Brightness: 'adj.brightness',
  Contrast: 'adj.contrast',
  Saturation: 'adj.saturation',
  Hue: 'adj.hue',
  Blur: 'adj.blur',
};

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
const backgroundType = ref('none');
const backgroundTypeItems = computed(() => [
  { label: t('adjust.background.none'), value: 'none' },
  { label: t('adjust.background.solid'), value: 'solid' },
  { label: t('adjust.background.gradient'), value: 'gradient' },
]);

// --- AI STATE ---
const bgStatusLabel = computed(() => {
  if (bgStatus.value === 'loading') return t('ai.statusLoading');
  if (bgStatus.value === 'processing') return t('ai.statusProcessing');
  if (bgStatus.value === 'loaded' || bgStatus.value === 'done') return t('ai.statusReady');
  if (bgStatus.value === 'error') return t('ai.statusError');
  return t('ai.statusIdle');
});
const isBgFailed = computed(() => bgStatus.value === 'error');
const lastNotifiedError = ref<string | null>(null);

const BG_OUTCOME_KEYS: Record<Exclude<BgRemovalOutcome, 'started'>, string> = {
  'no-canvas': 'ai.errNoCanvas',
  'no-selection': 'ai.errNoSelection',
  'no-source': 'ai.errNoSource',
  'failed': 'ai.errFailed',
};


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

const notifyAiError = (message: string | null) => {
  if (!message || message === lastNotifiedError.value) return;
  lastNotifiedError.value = message;
  toast.add({
    title: t('ai.errorTitle'),
    description: toUserError(message),
    icon: 'i-heroicons-exclamation-triangle',
    color: 'error'
  });
};

const toUserError = (message: string) => {
  if (message === BG_BUSY_CODE) return t('ai.errBusy');
  return message;
};

watch(error, (message) => notifyAiError(message));

watch(result, (files) => {
  if (files && files.length > 0) {
    toast.add({
      title: t('ai.successTitle'),
      description: t('ai.successDesc'),
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });
  }
});

// --- ACTIONS ---
const updatePosition = () => editor.value?.setPosition?.(position.value.x, position.value.y);
const handleOpacityUpdate = () => editor.value?.applyOpacity?.(opacity.value / 100);
const handleObjectFillUpdate = () => {
  if (activeLayer.value) {
    activeLayer.value.set('fill', objectFill.value);
    editor.value?.fabricCanvas?.requestRenderAll();
  }
};

const setFillMode = (mode: 'solid' | 'gradient') => {
  fillMode.value = mode;
  if (mode === 'solid') handleObjectFillUpdate();
};

const applyGradientFill = () => {
  if (!activeLayer.value) return;
  const radians = (gradientAngle.value * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  const gradient = new Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    coords: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy },
    colorStops: [
      { offset: 0, color: gradientStart.value },
      { offset: 1, color: gradientEnd.value },
    ],
  });
  activeLayer.value.set('fill', gradient);
  (activeLayer.value as { dirty?: boolean }).dirty = true;
  editor.value?.fabricCanvas?.requestRenderAll();
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

const handleBackgroundTypeChange = (value: string | null) => {
  const next = value ?? 'none';
  backgroundType.value = next;
  background.value.type = next;
  handleBackgroundUpdate();
};

const gradientKindItems = computed(() => [
  { label: t('section.gradientLinear'), value: 'linear' },
  { label: t('section.gradientRadial'), value: 'radial' },
]);

const handleGradientKindChange = (value: string | null) => {
  background.value.gradientType = value ?? 'linear';
  handleBackgroundUpdate();
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
  const id = editor.value?.addGuideline?.(orientation);
  if (!id) return;
  const all = (editor.value?.getGuidelines?.() ?? []) as Array<{ id: string; orientation: 'horizontal' | 'vertical'; position: number }>;
  const created = all.find(guide => guide.id === id);
  guidelines.value.push({ id, orientation, position: created?.position ?? 0 });
};

const handleRemoveGuideline = (id: string) => {
  editor.value?.removeGuideline?.(id);
  guidelines.value = guidelines.value.filter(g => g.id !== id);
};

const getGuideLabel = (guide: { orientation: string; position: number }) => {
  const kind = guide.orientation === 'horizontal' ? t('section.guideH') : t('section.guideV');
  return `${kind} · ${guide.position}`;
};

const handleClipImage = () => {
  const ok = editor.value?.clipActiveImage?.(24)
  useToast().add({
    title: ok ? t('section.clipApplied') : t('section.clipFailed'),
    color: ok ? 'success' : 'warning',
    icon: 'i-lucide-scissors',
  })
}

const handleRemoveClip = () => {
  const ok = editor.value?.removeImageClip?.()
  useToast().add({
    title: ok ? t('section.clipRemoved') : t('section.clipFailed'),
    color: ok ? 'neutral' : 'warning',
    icon: 'i-lucide-x',
  })
}

const isBgIdle = computed(() => bgStatus.value === 'idle');

const handleLoadModel = async () => {
  if (isBgBusy.value) return;
  try {
    await start();
  } catch {
    notifyAiError(error.value);
  }
};

const BUNDLED_FONT_FAMILIES = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New', 'Roboto', 'Open Sans', 'Lato'];

/**
 * A compact list — the full Google catalog (~1,900) used to be passed to this
 * Select. Mounting that when a text layer was selected blocked the main thread
 * for ~2s (Reka Select processed every item). The Fonts panel is the searchable
 * place for the full catalog.
 */
const fontFamilies = computed(() => {
  const families = new Set<string>(BUNDLED_FONT_FAMILIES);
  for (const object of editor.value?.fabricCanvas?.getObjects() ?? []) {
    const family = (object as { fontFamily?: string }).fontFamily;
    if (family) families.add(family);
  }
  const current = localTextSettings.value.fontFamily;
  if (current) families.add(current);
  return [...families];
});

const browseFonts = () => {
  setSidebarTab('fonts');
};

const HandleAlignObjects = (position: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
  editor.value?.alignObjects?.(position)
}
const HandleDistributeObjects = (position: 'horizontal' | 'vertical') => {
  editor.value?.distributeObjects?.(position)
}
const HandleFlipObjects = (direction: 'horizontal' | 'vertical') => {
  editor.value?.flip?.(direction)
}
const HandleRotateObjects = (direction: 'left' | 'right') => {
  editor.value?.rotateObject?.(direction)
}
const HandleBringForward = () => {
  editor.value?.arrangeFront?.()
}
const HandleSendBackward = () => {
  editor.value?.arrangeBack?.()
}
const HandleGroupSelection = () => {
  editor.value?.group?.()
}
const HandleUngroupSelection = () => {
  editor.value?.ungroup?.()
}
const HandleDuplicateSelection = () => {
  editor.value?.clone?.()
}
const HandleDeleteSelection = () => {
  editor.value?.deleteLayer?.()
}

const HandleSetCanvasSize = (width?: number, height?: number) => {
  editor.value?.updateFrameSettings?.({ width, height })
}
const handleCanvasWidthChange = (width: number | undefined) => {
  HandleSetCanvasSize(width || 0, editor.value?.globalSettings.value.height)
}
const handleCanvasHeightChange = (height: number | undefined) => {
  HandleSetCanvasSize(editor.value?.globalSettings.value.width, height || 0)
}
const HandleToggleRulers = () => {
  editor.value?.editorState.toggleRulers?.()
  editor.value?.toggleRulers?.(showRulers.value)
}
const HandleToggleSnapToGuides = () => {
  editor.value?.toggleGuidelineSnap?.(snapToGuides.value)
}

const HandleGradientColorAdd = (color: string) => {
  background.value.gradientColors.push(color)
  editor.value?.setBackgroundGradient?.({
    type: background.value.gradientType,
    colors: background.value.gradientColors,
    angle: background.value.gradientAngle
  });
}

const HandleUpdateGradientColorByPosition = (index: number, color?: string) => {
  background.value.gradientColors[index] = color || background.value.gradientColors[index] || '#000000';
  editor.value?.setBackgroundGradient?.({
    type: background.value.gradientType,
    colors: background.value.gradientColors,
    angle: background.value.gradientAngle
  });
}
const HandleUpdateGradientAngle = (angle?: number) => {

  background.value.gradientAngle = angle || background.value.gradientAngle || 0;
  editor.value?.setBackgroundGradient?.({
    type: background.value.gradientType,
    colors: background.value.gradientColors,
    angle: background.value.gradientAngle
  });
}

const handleSwitchTab = (tab: string) => {
  activeTab.value = tab;
}

const handleDownloadPng = () => {
  editor.value?.downloadCanvasImage?.();
}

const handleExportJson = () => {
  editor.value?.exportCurrentCanvas?.();
}

const handleRemoveBackground = async () => {
  if (isBgIdle.value) {
    toast.add({
      title: t('ai.errNeedLoad'),
      icon: 'i-heroicons-arrow-down-tray',
      color: 'warning'
    });
    return;
  }
  if (isBgBusy.value) {
    toast.add({
      title: t('ai.errBusy'),
      icon: 'i-heroicons-clock',
      color: 'warning'
    });
    return;
  }
  const outcome = await triggerRemoveBackground();
  if (outcome !== 'started') {
    toast.add({
      title: t(BG_OUTCOME_KEYS[outcome]),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning'
    });
  }
};

const handleFontFamilyChange = async (value: string | null) => {
  const family = value ?? localTextSettings.value.fontFamily;
  localTextSettings.value.fontFamily = family;
  await loadGoogleFont(family);
  updateTextSettings({ fontFamily: family });
};

const handleFontSizeChange = () => {
  updateTextSettings({ fontSize: localTextSettings.value.fontSize });
};

const handleTextFillInput = () => {
  updateTextSettings({ fill: localTextSettings.value.fill });
};

const handleToggleBold = () => {
  const next = localTextSettings.value.fontWeight === 'bold' ? 'normal' : 'bold';
  localTextSettings.value.fontWeight = next;
  updateTextSettings({ fontWeight: next });
};

const handleToggleItalic = () => {
  const next = localTextSettings.value.fontStyle === 'italic' ? 'normal' : 'italic';
  localTextSettings.value.fontStyle = next;
  updateTextSettings({ fontStyle: next });
};

const handleToggleUnderline = () => {
  const next = !localTextSettings.value.underline;
  localTextSettings.value.underline = next;
  updateTextSettings({ underline: next });
};

const handleTextAlign = (align: 'left' | 'center' | 'right') => {
  localTextSettings.value.textAlign = align;
  updateTextSettings({ textAlign: align });
};

const handleToggleShadow = () => {
  shadow.value.enabled = !shadow.value.enabled;
  handleShadowUpdate();
};

const handlePresetFilterChange = (value: string | null) => {
  const next = value ?? 'None';
  presetFilter.value = next;
  editor?.value?.applyPresetFilter?.(next);
};

const getAdjustmentLabel = (name: string) => t(adjustmentLabelKeys[name] ?? 'section.adjustTitle');

const isBoldActive = computed(() => localTextSettings.value.fontWeight === 'bold');
const isItalicActive = computed(() => localTextSettings.value.fontStyle === 'italic');
const isUnderlineActive = computed(() => !!localTextSettings.value.underline);
</script>

<template>
  <div class="h-full min-h-0 border-l border-default bg-default w-[300px] flex flex-col" data-testid="right-panel">

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-default p-2 shrink-0">
      <UButton
        :variant="activeTab === 'design' ? 'soft' : 'ghost'" color="neutral" size="xs" block
        @click="handleSwitchTab('design')">
        {{ t('tabs.design') }}
      </UButton>
      <UButton
        :variant="activeTab === 'export' ? 'soft' : 'ghost'" color="neutral" size="xs" block
        @click="handleSwitchTab('export')">
        {{ t('tabs.export') }}
      </UButton>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3">

      <div v-if="activeTab === 'design'" class="space-y-5">

        <!-- ARRANGE (selection) -->
        <section v-if="!isNoSelection">
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">{{ t('section.arrangeTitle') }}</h3>
          <div class="grid grid-cols-4 gap-1">
            <UTooltip :text="t('section.bringForward')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:arrow-up-to-line" :aria-label="t('section.bringForward')" @click="HandleBringForward" />
            </UTooltip>
            <UTooltip :text="t('section.sendBackward')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:arrow-down-to-line" :aria-label="t('section.sendBackward')" @click="HandleSendBackward" />
            </UTooltip>
            <UTooltip :text="t('section.group')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:group" :aria-label="t('section.group')" @click="HandleGroupSelection" />
            </UTooltip>
            <UTooltip :text="t('section.ungroup')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:ungroup" :aria-label="t('section.ungroup')" @click="HandleUngroupSelection" />
            </UTooltip>
          </div>
          <div class="grid grid-cols-2 gap-1 mt-1">
            <UButton size="xs" variant="ghost" color="neutral" icon="lucide:copy-plus" :label="t('header.duplicate')" @click="HandleDuplicateSelection" />
            <UButton size="xs" variant="ghost" color="error" icon="lucide:trash-2" :label="t('header.delete')" @click="HandleDeleteSelection" />
          </div>
        </section>

        <!-- ALIGNMENT (selection) -->
        <section v-if="!isNoSelection">
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">{{ t('section.alignTitle') }}</h3>
          <div class="grid grid-cols-6 gap-1 mb-1">
            <UTooltip :text="t('section.alignLeft')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:align-start-vertical" data-testid="align-left" @click="HandleAlignObjects('left')" />
            </UTooltip>
            <UTooltip :text="t('section.alignCenter')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:align-center-vertical" data-testid="align-center" @click="HandleAlignObjects('center')" />
            </UTooltip>
            <UTooltip :text="t('section.alignRight')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:align-end-vertical" data-testid="align-right" @click="HandleAlignObjects('right')" />
            </UTooltip>
            <UTooltip :text="t('section.alignTop')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:align-start-horizontal" data-testid="align-top" @click="HandleAlignObjects('top')" />
            </UTooltip>
            <UTooltip :text="t('section.alignMiddle')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:align-center-horizontal" data-testid="align-middle" @click="HandleAlignObjects('middle')" />
            </UTooltip>
            <UTooltip :text="t('section.alignBottom')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:align-end-horizontal" data-testid="align-bottom" @click="HandleAlignObjects('bottom')" />
            </UTooltip>
          </div>
          <div class="grid grid-cols-2 gap-1">
            <UButton size="xs" variant="ghost" color="neutral" :label="t('section.distributeH')" @click="HandleDistributeObjects('horizontal')" />
            <UButton size="xs" variant="ghost" color="neutral" :label="t('section.distributeV')" @click="HandleDistributeObjects('vertical')" />
          </div>
        </section>

        <!-- TRANSFORM (selection) -->
        <section v-if="!isNoSelection">
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">{{ t('section.transformTitle') }}</h3>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <UFormField :label="t('section.x')" size="xs">
              <UInput v-model.number="position.x" type="number" size="xs" @change="updatePosition" />
            </UFormField>
            <UFormField :label="t('section.y')" size="xs">
              <UInput v-model.number="position.y" type="number" size="xs" @change="updatePosition" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="t('section.w')" size="xs">
              <UInput v-model.number="size.width" type="number" size="xs" disabled />
            </UFormField>
            <UFormField :label="t('section.h')" size="xs">
              <UInput v-model.number="size.height" type="number" size="xs" disabled />
            </UFormField>
          </div>
          <!-- Rotation / Opacity -->
          <div class="mt-2">
            <div class="flex justify-between mb-1">
              <label class="text-xs text-muted">{{ t('section.opacity', { value: opacity.toFixed(0) }) }}</label>
            </div>
            <USlider v-model="opacity" :min="0" :max="100" size="xs" @update:model-value="handleOpacityUpdate" />
          </div>
          <!-- Flip & Rotate -->
          <div class="grid grid-cols-4 gap-1 mt-3">
            <UTooltip :text="t('section.flipH')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:flip-horizontal" data-testid="btn-flip-h" @click="HandleFlipObjects('horizontal')" />
            </UTooltip>
            <UTooltip :text="t('section.flipV')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:flip-vertical" data-testid="btn-flip-v" @click="HandleFlipObjects('vertical')" />
            </UTooltip>
            <UTooltip :text="t('section.rotateL')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:rotate-ccw" data-testid="btn-rotate-l" @click="HandleRotateObjects('left')" />
            </UTooltip>
            <UTooltip :text="t('section.rotateR')" class="min-w-0">
              <UButton block size="xs" variant="outline" color="neutral" icon="lucide:rotate-cw" data-testid="btn-rotate-r" @click="HandleRotateObjects('right')" />
            </UTooltip>
          </div>
        </section>

        <!-- TEXT PROPERTIES -->
        <section v-if="isTextLayerActive">
          <USeparator class="my-1" />
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('section.textTitle') }}</h3>

          <div class="space-y-3">
            <UFormField :label="t('section.fontFamily')" size="xs">
              <div class="space-y-1">
                <USelect
                  v-model="localTextSettings.fontFamily" :items="fontFamilies" size="sm"
                  class="w-full"
                  data-testid="select-font-family"
                  @update:model-value="handleFontFamilyChange" />
                <UButton
                  size="xs" variant="ghost" color="neutral" icon="lucide:search"
                  data-testid="browse-fonts" @click="browseFonts">
                  {{ t('section.browseFonts') }}
                </UButton>
              </div>
            </UFormField>

            <div class="flex items-end gap-2">
              <UFormField :label="t('section.fontSize')" size="xs" class="w-20">
                <UInput
                  v-model.number="localTextSettings.fontSize" type="number" size="xs"
                  data-testid="input-font-size" @change="handleFontSizeChange" />
              </UFormField>
              <UFormField :label="t('section.textColor')" size="xs" class="flex-1">
                <StudioColorField v-model="localTextSettings.fill" testid="input-text-fill" @update:model-value="handleTextFillInput" />
              </UFormField>
            </div>

            <div class="flex gap-1">
              <UButton
                :variant="isBoldActive ? 'solid' : 'outline'" color="neutral" size="xs"
                icon="lucide:bold" class="flex-1"
                data-testid="btn-bold"
                @click="handleToggleBold" />
              <UButton
                :variant="isItalicActive ? 'solid' : 'outline'" color="neutral" size="xs"
                icon="lucide:italic" class="flex-1"
                data-testid="btn-italic"
                @click="handleToggleItalic" />
              <UButton
                :variant="isUnderlineActive ? 'solid' : 'outline'" color="neutral" size="xs" icon="lucide:underline"
                class="flex-1"
                data-testid="btn-underline"
                @click="handleToggleUnderline" />
            </div>

            <div class="flex gap-1">
              <UButton
                :variant="localTextSettings.textAlign === 'left' ? 'solid' : 'outline'" color="neutral" icon="lucide:align-left"
                class="flex-1" size="xs" @click="handleTextAlign('left')" />
              <UButton
                :variant="localTextSettings.textAlign === 'center' ? 'solid' : 'outline'" color="neutral"
                icon="lucide:align-center" class="flex-1" size="xs" @click="handleTextAlign('center')" />
              <UButton
                :variant="localTextSettings.textAlign === 'right' ? 'solid' : 'outline'" color="neutral"
                icon="lucide:align-right" class="flex-1" size="xs" @click="handleTextAlign('right')" />
            </div>
          </div>
        </section>

        <!-- FILL (Shape/Text) -->
        <section v-if="!isNoSelection && !isImageLayerActive">
          <USeparator class="my-1" />
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('section.fillTitle') }}</h3>
          <div class="mb-2 flex gap-1">
            <UButton size="xs" :variant="fillMode === 'solid' ? 'soft' : 'ghost'" :color="fillMode === 'solid' ? 'primary' : 'neutral'" @click="setFillMode('solid')">
              {{ t('section.fillSolid') }}
            </UButton>
            <UButton size="xs" :variant="fillMode === 'gradient' ? 'soft' : 'ghost'" :color="fillMode === 'gradient' ? 'primary' : 'neutral'" @click="setFillMode('gradient')">
              {{ t('section.fillGradient') }}
            </UButton>
          </div>

          <StudioColorField
            v-if="fillMode === 'solid'"
            v-model="objectFill"
            testid="input-fill" @update:model-value="handleObjectFillUpdate" />

          <div v-else class="space-y-2">
            <UFormField :label="t('section.gradientStart')" size="xs">
              <StudioColorField v-model="gradientStart" testid="input-gradient-start" />
            </UFormField>
            <UFormField :label="t('section.gradientEnd')" size="xs">
              <StudioColorField v-model="gradientEnd" testid="input-gradient-end" />
            </UFormField>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted">{{ t('section.gradientAngle') }}</span>
              <USlider v-model="gradientAngle" :min="0" :max="360" size="xs" class="flex-1" />
              <span class="w-9 text-right text-[11px] font-mono">{{ gradientAngle }}°</span>
            </div>
            <UButton block size="xs" color="primary" variant="soft" icon="lucide:paintbrush" @click="applyGradientFill">
              {{ t('section.applyGradient') }}
            </UButton>
          </div>
        </section>

        <!-- STROKE -->
        <section v-if="!isNoSelection && !isTextLayerActive">
          <USeparator class="my-1" />
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('section.strokeTitle') }}</h3>
          <div class="space-y-2">
            <UFormField :label="t('section.textColor')" size="xs">
              <StudioColorField v-model="stroke.color" testid="input-stroke-color" @update:model-value="handleStrokeUpdate" />
            </UFormField>
            <UFormField :label="`${t('section.strokeWidth')} (${t('section.strokePx')})`" size="xs">
              <UInput
                v-model.number="stroke.width" type="number" size="xs"
                data-testid="input-stroke-width" @change="handleStrokeUpdate" />
            </UFormField>
          </div>
        </section>

        <!-- EFFECTS (Shadow) -->
        <section v-if="!isNoSelection">
          <USeparator class="my-1" />
          <div class="flex items-center justify-between my-2">
            <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('section.effectsTitle') }}</h3>
            <UButton
              size="xs" variant="ghost" color="neutral" icon="lucide:plus"
              data-testid="add-shadow" @click="handleToggleShadow" />
          </div>

          <div v-if="shadow.enabled" v-motion-fade-visible :duration="200" class="space-y-2 bg-elevated p-2.5 rounded-xl border border-default">
            <div class="flex justify-between items-center">
              <span class="text-xs">{{ t('section.shadow') }}</span>
              <USwitch v-model="shadow.enabled" size="xs" @update:model-value="handleShadowUpdate" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <UFormField :label="t('section.shadowX')" size="xs">
                <UInput v-model.number="shadow.offsetX" size="xs" @change="handleShadowUpdate" />
              </UFormField>
              <UFormField :label="t('section.shadowY')" size="xs">
                <UInput v-model.number="shadow.offsetY" size="xs" @change="handleShadowUpdate" />
              </UFormField>
              <UFormField :label="t('section.shadowBlur')" size="xs">
                <UInput v-model.number="shadow.blur" size="xs" :placeholder="t('section.shadowBlur')" @change="handleShadowUpdate" />
              </UFormField>
            </div>
            <UFormField :label="t('section.shadowColor')" size="xs">
              <StudioColorField v-model="shadow.color" testid="input-shadow-color" @update:model-value="handleShadowUpdate" />
            </UFormField>
          </div>
        </section>

        <!-- AI TOOLS -->
        <section v-if="isImageLayerActive">
          <USeparator class="my-1" />
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('ai.title') }}</h3>
          <div class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2.5">
            <div v-if="isBgIdle" v-motion-fade-visible :duration="200" class="space-y-2.5 text-center">
              <Icon name="lucide:sparkles" class="w-8 h-8 text-primary mx-auto" />
              <p class="text-xs text-muted">{{ t('ai.loadDesc') }}</p>
              <UButton
                block variant="soft" color="primary" icon="lucide:download"
                data-testid="btn-load-model"
                :label="t('ai.loadModel')" @click="handleLoadModel" />
            </div>
            <UButton
              v-else
              block variant="soft" color="primary" icon="lucide:sparkles"
              data-testid="btn-remove-bg"
              :loading="isBgBusy" @click="handleRemoveBackground">
              {{ t('ai.removeBackground') }}
            </UButton>
            <div v-if="isBgBusy" v-motion-fade-visible :duration="200" class="space-y-1.5" data-testid="bg-status">
              <div class="flex items-center gap-2 text-xs text-muted">
                <Icon name="svg-spinners:270-ring-with-bg" class="w-4 h-4 shrink-0" />
                <span class="truncate">{{ bgStatusLabel }}</span>
                <span class="ml-auto font-mono shrink-0">{{ Math.round(bgProgress) }}%</span>
              </div>
              <UProgress :model-value="bgProgress" :max="100" size="xs" />
            </div>
            <div v-else class="text-xs text-muted" data-testid="bg-status">
              {{ bgStatusLabel }}
            </div>
            <UAlert
              v-if="isBgFailed"
              v-motion-fade-visible :duration="200"
              color="error" variant="subtle" icon="i-heroicons-exclamation-triangle"
              :title="t('ai.statusError')" :description="bgError ?? undefined" />
            <UButton
              v-if="isBgFailed"
              block size="xs" variant="soft" color="error" icon="lucide:rotate-ccw"
              :label="t('ai.retry')" @click="handleLoadModel" />
          </div>
        </section>

        <!-- REPLACE IMAGE -->
        <section v-if="isImageLayerActive">
          <USeparator class="my-1" />
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('studio.replace.title') }}</h3>
          <div class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
            <div class="flex gap-1">
              <UButton
                size="xs" class="flex-1"
                :variant="replaceSource === 'upload' ? 'soft' : 'ghost'"
                :color="replaceSource === 'upload' ? 'primary' : 'neutral'"
                data-testid="replace-tab-upload" @click="setReplaceSource('upload')">
                {{ t('studio.replace.upload') }}
              </UButton>
              <UButton
                size="xs" class="flex-1"
                :variant="replaceSource === 'url' ? 'soft' : 'ghost'"
                :color="replaceSource === 'url' ? 'primary' : 'neutral'"
                data-testid="replace-tab-url" @click="setReplaceSource('url')">
                {{ t('studio.replace.url') }}
              </UButton>
              <UButton
                size="xs" class="flex-1"
                :variant="replaceSource === 'assets' ? 'soft' : 'ghost'"
                :color="replaceSource === 'assets' ? 'primary' : 'neutral'"
                data-testid="replace-tab-assets" @click="setReplaceSource('assets')">
                {{ t('studio.replace.assets') }}
              </UButton>
            </div>

            <div v-if="replaceSource === 'upload'" class="space-y-2">
              <input
                ref="replaceInput" type="file" accept="image/*" class="hidden"
                data-testid="replace-image-input" @change="handleReplaceUpload">
              <UButton
                block size="xs" variant="soft" color="primary" icon="lucide:upload"
                :loading="replacing" data-testid="replace-upload-button" @click="triggerReplaceInput">
                {{ t('studio.replace.choose') }}
              </UButton>
            </div>

            <div v-else-if="replaceSource === 'url'" class="space-y-2">
              <UInput
                v-model="replaceUrl" size="xs"
                :placeholder="t('studio.replace.urlPlaceholder')"
                data-testid="replace-url-input"
                @keydown.enter="applyReplaceUrl" />
              <UButton
                block size="xs" variant="soft" color="primary" icon="lucide:link"
                :loading="replacing" data-testid="replace-url-apply" @click="applyReplaceUrl">
                {{ t('studio.replace.applyUrl') }}
              </UButton>
            </div>

            <div v-else class="space-y-2">
              <div v-if="assetsLoading" class="py-2 text-center text-xs text-muted">{{ t('studio.replace.loading') }}</div>
              <UAlert
                v-else-if="assetsError" color="warning" variant="soft"
                icon="i-lucide-lock" :title="t('studio.replace.assetsAuth')" />
              <div v-else-if="designAssets.length === 0" class="py-2 text-center text-xs text-muted">
                {{ t('studio.replace.assetsEmpty') }}
              </div>
              <div v-else class="grid grid-cols-3 gap-1 max-h-44 overflow-y-auto">
                <button
                  v-for="asset in designAssets" :key="asset.name"
                  type="button"
                  class="aspect-square overflow-hidden rounded border border-default hover:border-primary"
                  :aria-label="asset.name"
                  @click="applyAsset(asset.name)">
                  <img :src="assetUrl(asset.name)" alt="" class="h-full w-full object-cover" loading="lazy">
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] text-muted">{{ t('studio.replace.fit') }}</span>
              <USwitch v-model="replaceResize" size="xs" data-testid="replace-fit" />
            </div>
          </div>
        </section>

        <!-- IMAGE FILTERS -->
        <section v-if="isImageLayerActive">
          <USeparator class="my-1" />

          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('section.clip') }}</h3>
          <div class="flex gap-2 mb-3">
            <UButton size="xs" variant="outline" icon="lucide:scissors" @click="handleClipImage">
              {{ t('section.clipRounded') }}
            </UButton>
            <UButton size="xs" variant="ghost" color="neutral" icon="lucide:x" @click="handleRemoveClip">
              {{ t('section.removeClip') }}
            </UButton>
          </div>

          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider my-2">{{ t('section.filtersTitle') }}</h3>

          <div class="space-y-3">
            <UFormField :label="t('section.preset')" size="xs">
              <USelect
                :model-value="presetFilter" :items="presetFilterItems" value-key="value" size="xs"
                @update:model-value="handlePresetFilterChange" />
            </UFormField>

            <div v-for="(val, name) in filtersRef" :key="name">
              <div class="flex justify-between mb-1">
                <label class="text-xs text-muted">{{ getAdjustmentLabel(name) }}</label>
                <span class="text-xs font-mono text-muted">{{ (filtersRef as any)[name] }}</span>
              </div>
              <USlider
                v-model="(filtersRef as any)[name]" :min="-100" :max="100" size="xs"
                @update:model-value="handleFilterUpdate(name)" />
            </div>
          </div>
        </section>


        <!-- CANVAS BACKGROUND (No selection) -->
        <section v-if="isNoSelection">
          <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">{{ t('section.canvasTitle') }}</h3>

          <div class="space-y-4">
            <!-- CANVAS RESIZE -->
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs text-muted">{{ t('section.canvasSize') }}:
                  {{ editor?.globalSettings.value.width }} x {{ editor?.globalSettings.value.height }}</span>
              </div>
              <div v-if="editor" class="grid grid-cols-2 gap-2 mb-2">
                <UFormField :label="t('section.w')" size="xs">
                  <UInputNumber
                    v-model="editor.globalSettings.value.width" size="xs"
                    @update:model-value="handleCanvasWidthChange" />
                </UFormField>
                <UFormField :label="t('section.h')" size="xs">
                  <UInputNumber
                    v-model="editor.globalSettings.value.height" size="xs"
                    @update:model-value="handleCanvasHeightChange" />
                </UFormField>
              </div>
              <div class="grid grid-cols-2 gap-1">
                <UButton size="xs" variant="outline" color="neutral" @click="HandleSetCanvasSize(1080, 1080)">
                  {{ t('section.presetIgPost') }}</UButton>
                <UButton size="xs" variant="outline" color="neutral" @click="HandleSetCanvasSize(1080, 1920)">
                  {{ t('section.presetStory') }}</UButton>
                <UButton size="xs" variant="outline" color="neutral" @click="HandleSetCanvasSize(1920, 1080)">
                  {{ t('section.presetFullHd') }}</UButton>
                <UButton size="xs" variant="outline" color="neutral" @click="HandleSetCanvasSize(1080, 750)">
                  {{ t('section.presetFbCover') }}</UButton>
              </div>
            </div>

            <USeparator />
            <!-- RULERS -->
            <div class="space-y-2">
              <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('section.rulersTitle') }}</h3>
              <div class="flex justify-between items-center">
                <span class="text-xs">{{ t('section.rulersShow') }}</span>
                <USwitch
                  v-model="showRulers" size="xs" data-testid="toggle-rulers"
                  @update:model-value="HandleToggleRulers" />
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs">{{ t('section.rulersSnap') }}</span>
                <USwitch
                  v-model="snapToGuides" size="xs" data-testid="toggle-snap-to-guides"
                  @update:model-value="HandleToggleSnapToGuides" />
              </div>
              <div class="flex gap-1">
                <UButton size="xs" variant="outline" color="neutral" class="flex-1" @click="handleAddGuideline('horizontal')">{{ t('section.guideH') }}
                </UButton>
                <UButton size="xs" variant="outline" color="neutral" class="flex-1" @click="handleAddGuideline('vertical')">{{ t('section.guideV') }}
                </UButton>
              </div>
              <div v-if="guidelines.length > 0" class="flex flex-wrap gap-1">
                <UBadge
                  v-for="guide in guidelines" :key="guide.id" color="neutral" variant="soft" size="xs"
                  class="cursor-pointer" @click="handleRemoveGuideline(guide.id)">
                  {{ getGuideLabel(guide) }}
                </UBadge>
              </div>
            </div>

            <USeparator />

            <div>
              <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider mb-2">{{ t('section.bgTitle') }}</h3>
              <UFormField :label="t('section.bgType')" size="xs">
                <USelect
                  :model-value="backgroundType" :items="backgroundTypeItems" value-key="value" size="xs"
                  data-testid="select-bg-type" @update:model-value="handleBackgroundTypeChange" />
              </UFormField>
              <div v-if="background.type === 'solid'" v-motion-fade-visible :duration="200" class="mt-3 rounded-xl border border-default bg-elevated/50 p-3">
                <StudioColorField
                  v-model="background.solidColor"
                  @update:model-value="handleBackgroundUpdate" />
              </div>
              <div v-if="background.type === 'gradient'" v-motion-fade-visible :duration="200" class="mt-3 rounded-xl border border-default bg-elevated/50 p-3 space-y-3">
                <UFormField :label="t('section.bgType')" size="xs">
                  <USelect
                    :model-value="background.gradientType" :items="gradientKindItems" value-key="value" size="xs"
                    data-testid="select-gradient-kind" @update:model-value="handleGradientKindChange" />
                </UFormField>
                <div>
                  <div class="flex justify-between mb-1">
                    <label class="text-xs text-muted">{{ t('section.bgGradientAngle') }}</label>
                    <span class="text-xs font-mono text-muted">{{ background.gradientAngle }}°</span>
                  </div>
                  <USlider
                    v-model="background.gradientAngle" :min="0" :max="360" size="xs"
                    @update:model-value="HandleUpdateGradientAngle" />
                </div>
                <div class="flex gap-2">
                  <StudioColorField
                    v-for="(color, index) in background.gradientColors" :key="`${index}-${color}`"
                    :model-value="color"
                    @update:model-value="(c) => HandleUpdateGradientColorByPosition(index, c)" />
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      <div v-if="activeTab === 'export'" v-motion-fade-visible :duration="200" class="flex flex-col h-full justify-center items-center text-center p-4">
        <Icon name="lucide:image" class="w-12 h-12 text-dimmed mb-4" />
        <p class="text-sm text-muted mb-4">{{ t('section.exportHint') }}</p>
        <div class="w-full space-y-2">
          <UButton color="primary" block icon="lucide:download" :label="t('section.downloadPng')" @click="handleDownloadPng" />
          <UButton color="neutral" variant="outline" block icon="lucide:film" :label="t('studio.timeline.mp4')" :loading="exportingMp4" data-testid="btn-export-mp4" @click="handleExportMp4" />
          <p class="text-[10px] leading-tight text-muted">{{ t('studio.timeline.mp4Hint') }}</p>
          <UButton color="neutral" variant="outline" block icon="lucide:file-json" :label="t('section.exportJson')" @click="handleExportJson" />
        </div>
      </div>

    </div>
  </div>
</template>
