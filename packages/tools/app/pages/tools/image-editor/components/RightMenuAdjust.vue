<i18n src="../ImageEditor.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Enhanced adjust panel with Figma-style UI
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { computed, watch, ref } from 'vue';
import { IText, FabricImage, type ITextProps } from 'fabric';
import { useFabricJs } from '../composables/useFabricJs';

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
  updateShadow,
  removeShadow,
  updateStroke,
  setBackgroundColor,
  setBackgroundGradient,
  clearBackground,
  updateTextProperties,
  applyOpacity,
  applyImageAdjustment,
  applyPresetFilter
} = useFabricJs();

const activeLayer = computed(() => editor.value?.activeLayer?.value);
const isTextLayerActive = computed(() => activeLayer.value?.type === 'i-text' || activeLayer.value?.type === 'text');
const isImageLayerActive = computed(() => activeLayer.value?.type === 'image');
const isWorkspaceFrame = computed(() => (activeLayer.value as any)?.id === 'workspace');

const shadow = ref({
  enabled: false,
  offsetX: 5,
  offsetY: 5,
  blur: 10,
  color: '#000000'
});

const stroke = ref({
  width: 0,
  color: '#000000',
  style: 'solid'
});

const background = ref({
  type: 'none',
  solidColor: '#ffffff',
  gradientType: 'linear',
  gradientColors: ['#ffffff', '#000000'],
  gradientAngle: 0
});

const objectFill = ref('#cccccc');

const textProps = ref({
  letterSpacing: 0,
  lineHeight: 1.16
});

const opacity = ref(100);

const filtersRef = ref({
  Brightness: 0,
  Contrast: 0,
  Saturation: 0,
  Hue: 0,
  Blur: 0,
  Sharpen: 0,
  Invert: 0
});

const presetFilter = ref('None');

const extractTextProps = (obj: IText | ITextProps | any): TextAdjustmentProps => {
  const fillValue = typeof obj.fill === 'string' ? obj.fill : (obj.fill === null ? null : '#000000');

  return {
    fontSize: obj.fontSize,
    fontFamily: obj.fontFamily,
    fill: fillValue,
    fontWeight: obj.fontWeight,
    fontStyle: obj.fontStyle,
    underline: obj.underline,
    linethrough: obj.linethrough,
    overline: obj.overline,
    textAlign: obj.textAlign,
  };
};

const localTextSettings = ref<TextAdjustmentProps>(extractTextProps({ fill: '#000000' }));

watch(activeLayer, (newVal) => {
  if (newVal?.type === 'i-text' || newVal?.type === 'text') {
    localTextSettings.value = extractTextProps(newVal);
    textProps.value.letterSpacing = ((newVal as any).charSpacing || 0) / 10;
    textProps.value.lineHeight = (newVal as any).lineHeight || 1.16;
  }
  if (newVal) {
    opacity.value = (newVal.opacity || 1) * 100;

    if (newVal.shadow) {
      const s = newVal.shadow as any;
      shadow.value = {
        enabled: true,
        offsetX: s.offsetX || 0,
        offsetY: s.offsetY || 0,
        blur: s.blur || 0,
        color: s.color || '#000000'
      };
    } else {
      shadow.value.enabled = false;
    }

    stroke.value = {
      width: newVal.strokeWidth || 0,
      color: (newVal.stroke as string) || '#000000',
      style: 'solid'
    };

    if (typeof newVal.fill === 'string') {
      objectFill.value = newVal.fill;
    }

    if (newVal?.type === 'image') {
      const f = (newVal as any).filters || [];
      // This is a simplification; actual filter values might need extraction from Fabirc objects
    }
  }
}, { immediate: true });

const fontFamilies = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Impact', value: 'Impact' },
  { label: '--- Google Fonts ---', value: '', disabled: true },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Oswald', value: 'Oswald' },
  { label: 'Raleway', value: 'Raleway' },
  { label: 'Nunito', value: 'Nunito' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Merriweather', value: 'Merriweather' },
  { label: 'PT Sans', value: 'PT Sans' },
  { label: 'Source Sans Pro', value: 'Source Sans Pro' },
  { label: 'Quicksand', value: 'Quicksand' },
  { label: 'Work Sans', value: 'Work Sans' },
  { label: 'Noto Sans', value: 'Noto Sans' },
  { label: 'Ubuntu', value: 'Ubuntu' },
  { label: 'Rubik', value: 'Rubik' },
  { label: 'Bebas Neue', value: 'Bebas Neue' },
  { label: 'Josefin Sans', value: 'Josefin Sans' },
  { label: 'Comfortaa', value: 'Comfortaa' }
];

const loadGoogleFont = (fontFamily: string) => {
  if (!fontFamily || fontFamily.includes('Arial') || fontFamily.includes('---')) return;

  const fontName = fontFamily.replace(/ /g, '+');
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
  link.rel = 'stylesheet';

  if (!document.querySelector(`link[href*="${fontName}"]`)) {
    document.head.appendChild(link);
  }
};

const textAlignOptions = [
  { label: 'Left', value: 'left', icon: 'lucide:align-left' },
  { label: 'Center', value: 'center', icon: 'lucide:align-center' },
  { label: 'Right', value: 'right', icon: 'lucide:align-right' },
  { label: 'Justify', value: 'justify', icon: 'lucide:align-justify' },
];

const strokeStyles = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' }
];

const isBold = computed({
  get: () => localTextSettings.value.fontWeight === 'bold',
  set: (val: boolean) => {
    localTextSettings.value.fontWeight = val ? 'bold' : 'normal';
  },
});

const isItalic = computed({
  get: () => localTextSettings.value.fontStyle === 'italic',
  set: (val: boolean) => {
    localTextSettings.value.fontStyle = val ? 'italic' : 'normal';
  },
});

const updateTextSettings = (settings: ITextProps) => {
  if (activeLayer.value?.type === 'i-text' || activeLayer.value?.type === 'text') {
    try {
      if (settings.fontFamily) {
        loadGoogleFont(settings.fontFamily as string);
      }
      Object.keys(settings).forEach(key => {
        activeLayer.value?.set(key as any, (settings as any)[key]);
      });
      activeLayer.value.setCoords();
      editor.value?.fabricCanvas?.requestRenderAll();
      toast.add({ title: 'Text updated', color: 'primary', icon: 'lucide:check' });
    } catch (error) {
      toast.add({ title: 'Failed to update text', color: 'error', icon: 'lucide:x' });
    }
  }
};

const handleShadowUpdate = () => {
  try {
    if (shadow.value.enabled) {
      updateShadow({
        offsetX: shadow.value.offsetX,
        offsetY: shadow.value.offsetY,
        blur: shadow.value.blur,
        color: shadow.value.color
      });
      toast.add({ title: 'Shadow applied', color: 'primary', icon: 'lucide:check' });
    } else {
      removeShadow();
      toast.add({ title: 'Shadow removed', color: 'primary', icon: 'lucide:check' });
    }
  } catch (error) {
    toast.add({ title: 'Failed to update shadow', color: 'error', icon: 'lucide:x' });
  }
};

const handleStrokeUpdate = () => {
  try {
    const dashArray = stroke.value.style === 'dashed' ? [10, 5] :
      stroke.value.style === 'dotted' ? [2, 2] : undefined;

    updateStroke({
      width: stroke.value.width,
      color: stroke.value.color,
      dashArray
    });
    toast.add({ title: 'Stroke updated', color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: 'Failed to update stroke', color: 'error', icon: 'lucide:x' });
  }
};

const handleBackgroundUpdate = () => {
  try {
    if (background.value.type === 'none') {
      clearBackground();
      toast.add({ title: 'Background cleared', color: 'primary', icon: 'lucide:check' });
    } else if (background.value.type === 'solid') {
      setBackgroundColor(background.value.solidColor);
      toast.add({ title: 'Background color applied', color: 'primary', icon: 'lucide:check' });
    } else if (background.value.type === 'gradient') {
      setBackgroundGradient({
        type: background.value.gradientType as 'linear' | 'radial',
        colors: background.value.gradientColors,
        angle: background.value.gradientAngle
      });
      toast.add({ title: 'Gradient applied', color: 'primary', icon: 'lucide:check' });
    }
  } catch (error) {
    toast.add({ title: 'Failed to update background', color: 'error', icon: 'lucide:x' });
  }
};

const handleOpacityUpdate = () => {
  try {
    applyOpacity(opacity.value / 100);
    toast.add({ title: 'Opacity updated', color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: 'Failed to update opacity', color: 'error', icon: 'lucide:x' });
  }
};

const handleTextPropsUpdate = () => {
  try {
    updateTextProperties({
      letterSpacing: textProps.value.letterSpacing,
      lineHeight: textProps.value.lineHeight
    });
    toast.add({ title: 'Text properties updated', color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: 'Failed to update text properties', color: 'error', icon: 'lucide:x' });
  }
};

const handleObjectFillUpdate = () => {
  try {
    if (activeLayer.value) {
      activeLayer.value.set('fill', objectFill.value);
      activeLayer.value.setCoords();
      editor.value?.fabricCanvas?.requestRenderAll();
      toast.add({ title: 'Fill color updated', color: 'primary', icon: 'lucide:check' });
    }
  } catch (error) {
    toast.add({ title: 'Failed to update fill', color: 'error', icon: 'lucide:x' });
  }
};
const handleFilterUpdate = (filterType: any) => {
  try {
    const val = (filtersRef.value as any)[filterType];
    applyImageAdjustment(filterType, val / 100);
    toast.add({ title: `${filterType} adjusted`, color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: `Failed to adjust ${filterType}`, color: 'error', icon: 'lucide:x' });
  }
};

const handlePresetUpdate = () => {
  try {
    applyPresetFilter(presetFilter.value);
    toast.add({ title: `Filter ${presetFilter.value} applied`, color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: 'Failed to apply filter', color: 'error', icon: 'lucide:x' });
  }
};

const accordionItems = computed(() => {
  const items = [];

  if (isTextLayerActive.value) {
    items.push({
      label: 'Text',
      icon: 'lucide:type',
      slot: 'text',
      defaultOpen: true
    });
  }

  if (isImageLayerActive.value) {
    items.push({
      label: 'Filters',
      icon: 'lucide:image',
      slot: 'filters',
      defaultOpen: true
    });
  }

  if (activeLayer.value) {
    items.push({
      label: isWorkspaceFrame.value ? 'Frame Fill' : 'Fill Color',
      icon: 'lucide:paintbrush-2',
      slot: 'fill',
      defaultOpen: !isTextLayerActive.value && !isImageLayerActive.value
    });

    items.push({
      label: t('adjust.shadow.title', 'Shadow'),
      icon: 'lucide:layers',
      slot: 'shadow'
    });

    items.push({
      label: t('adjust.stroke.title', 'Stroke'),
      icon: 'lucide:square',
      slot: 'stroke'
    });

    items.push({
      label: t('adjust.opacity.title', 'Opacity'),
      icon: 'lucide:circle-half',
      slot: 'opacity'
    });
  }

  items.push({
    label: t('adjust.background.title', 'Canvas'),
    icon: 'lucide:paintbrush',
    slot: 'canvas',
    defaultOpen: !activeLayer.value
  });

  return items;
});
</script>

<template>
  <section class="max-h-[calc(100vh-120px)] overflow-y-auto">
    <UAccordion :items="accordionItems" multiple class="px-3 py-1">
      <template #text>
        <div class="space-y-4 pb-2 pt-2">
          <UFormField :label="t('adjust.text.fontSize', 'Size')" size="xs">
            <div class="flex items-center gap-2">
              <URange v-model="localTextSettings.fontSize" :min="1" :max="200" :step="1" size="sm" class="flex-1"
                @update:model-value="updateTextSettings(localTextSettings as ITextProps)" />
              <UInput v-model.number="localTextSettings.fontSize" type="number" size="sm" class="w-16 font-mono"
                @change="updateTextSettings(localTextSettings as ITextProps)" />
            </div>
          </UFormField>

          <div class="grid grid-cols-1 gap-4">
            <UFormField :label="t('adjust.text.fontFamily', 'Font')" size="xs">
              <USelect v-model="localTextSettings.fontFamily" :options="fontFamilies" option-attribute="label"
                value-attribute="value" size="sm" @change="updateTextSettings(localTextSettings as ITextProps)" />
            </UFormField>

            <div class="flex items-center justify-between gap-4">
              <div class="flex-1">
                <label class="text-[10px] font-medium text-gray-500 mb-1 block">Color</label>
                <UColorPicker v-model="localTextSettings.fill" size="sm"
                  @update:model-value="updateTextSettings(localTextSettings as ITextProps)" />
              </div>
              <div class="flex-1">
                <label class="text-[10px] font-medium text-gray-500 mb-1 block">Style</label>
                <div class="flex gap-1">
                  <UButton :variant="isBold ? 'solid' : 'outline'" size="xs" icon="lucide:bold" class="flex-1"
                    @click="isBold = !isBold; updateTextSettings(localTextSettings as ITextProps)" />
                  <UButton :variant="isItalic ? 'solid' : 'outline'" size="xs" icon="lucide:italic" class="flex-1"
                    @click="isItalic = !isItalic; updateTextSettings(localTextSettings as ITextProps)" />
                  <UButton :variant="localTextSettings.underline ? 'solid' : 'outline'" size="xs"
                    icon="lucide:underline" class="flex-1"
                    @click="localTextSettings.underline = !localTextSettings.underline; updateTextSettings(localTextSettings as ITextProps)" />
                  <UButton :variant="localTextSettings.linethrough ? 'solid' : 'outline'" size="xs"
                    icon="lucide:strikethrough" class="flex-1"
                    @click="localTextSettings.linethrough = !localTextSettings.linethrough; updateTextSettings(localTextSettings as ITextProps)" />
                </div>
              </div>
            </div>

            <div>
              <label class="text-[10px] font-medium text-gray-500 mb-1 block">Alignment</label>
              <UButtonGroup size="sm" class="w-full">
                <UButton v-for="align in textAlignOptions" :key="align.value" :icon="align.icon"
                  :variant="localTextSettings.textAlign === align.value ? 'solid' : 'outline'" class="flex-1"
                  @click="localTextSettings.textAlign = align.value; updateTextSettings(localTextSettings as ITextProps)" />
              </UButtonGroup>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ t('adjust.text.letterSpacing', 'Letter Spacing') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <URange v-model="textProps.letterSpacing" :min="-20" :max="50" :step="1" size="sm" class="flex-1"
                @update:model-value="handleTextPropsUpdate" />
              <UInput v-model.number="textProps.letterSpacing" type="number" size="sm" class="w-16 font-mono"
                @change="handleTextPropsUpdate" />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ t('adjust.text.lineHeight', 'Line Height') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <URange v-model="textProps.lineHeight" :min="0.1" :max="4" :step="0.01" size="sm" class="flex-1"
                @update:model-value="handleTextPropsUpdate" />
              <UInput v-model.number="textProps.lineHeight" type="number" size="sm" step="0.01" class="w-16 font-mono"
                @change="handleTextPropsUpdate" />
            </div>
          </div>
        </div>
      </template>

      <template #filters>
        <div class="space-y-4 pb-2 pt-2">
          <UFormField label="Preset" size="xs">
            <USelect v-model="presetFilter"
              :options="['None', 'Grayscale', 'Invert', 'Sepia', 'Kodachrome', 'Polaroid', 'BlackWhite']" size="sm"
              @change="handlePresetUpdate" />
          </UFormField>

          <div class="space-y-3">
            <div v-for="(val, name) in filtersRef" :key="name">
              <div class="flex items-center justify-between mb-1">
                <label class="text-[10px] font-medium text-gray-700 dark:text-gray-300">{{ name }}</label>
              </div>
              <div class="flex items-center gap-2">
                <URange v-model="(filtersRef as any)[name]" :min="name === 'Hue' ? -100 : (name === 'Blur' ? 0 : -100)"
                  :max="100" :step="1" size="sm" class="flex-1" @update:model-value="handleFilterUpdate(name)" />
                <UInput v-model.number="(filtersRef as any)[name]" type="number" size="sm"
                  class="w-14 font-mono text-[10px]" @change="handleFilterUpdate(name)" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #fill>
        <div class="pb-2 pt-2">
          <label class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Color</label>
          <UColorPicker v-model="objectFill" @update:model-value="handleObjectFillUpdate" />
        </div>
      </template>

      <template #shadow>
        <div class="space-y-4 pb-2 pt-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-gray-700 dark:text-gray-300">Enabled</label>
            <USwitch v-model="shadow.enabled" @update:model-value="handleShadowUpdate" size="sm" />
          </div>

          <div v-if="shadow.enabled" class="space-y-3">
            <div class="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label class="text-[10px] font-medium text-gray-500 mb-1 block">X Offset</label>
                <div class="flex items-center gap-2">
                  <URange v-model="shadow.offsetX" :min="-50" :max="50" :step="1" size="sm" class="flex-1"
                    @update:model-value="handleShadowUpdate" />
                  <UInput v-model.number="shadow.offsetX" type="number" size="xs" class="w-12 font-mono text-[10px]"
                    @change="handleShadowUpdate" />
                </div>
              </div>

              <div>
                <label class="text-[10px] font-medium text-gray-500 mb-1 block">Y Offset</label>
                <div class="flex items-center gap-2">
                  <URange v-model="shadow.offsetY" :min="-50" :max="50" :step="1" size="sm" class="flex-1"
                    @update:model-value="handleShadowUpdate" />
                  <UInput v-model.number="shadow.offsetY" type="number" size="xs" class="w-12 font-mono text-[10px]"
                    @change="handleShadowUpdate" />
                </div>
              </div>
            </div>

            <div>
              <label class="text-[10px] font-medium text-gray-500 mb-1 block">Blur</label>
              <div class="flex items-center gap-2">
                <URange v-model="shadow.blur" :min="0" :max="50" :step="1" size="sm" class="flex-1"
                  @update:model-value="handleShadowUpdate" />
                <UInput v-model.number="shadow.blur" type="number" size="xs" class="w-12 font-mono text-[10px]"
                  @change="handleShadowUpdate" />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-[10px] font-medium text-gray-700 dark:text-gray-300">Color</label>
              <UColorPicker v-model="shadow.color" @update:model-value="handleShadowUpdate" />
            </div>
          </div>
        </div>
      </template>

      <template #stroke>
        <div class="space-y-4 pb-2 pt-2">
          <div>
            <label class="text-[10px] font-medium text-gray-500 mb-1 block">Width</label>
            <div class="flex items-center gap-2">
              <URange v-model="stroke.width" :min="0" :max="20" :step="1" size="sm" class="flex-1"
                @update:model-value="handleStrokeUpdate" />
              <UInput v-model.number="stroke.width" type="number" size="xs" class="w-12 font-mono text-[10px]"
                @change="handleStrokeUpdate" />
            </div>
          </div>

          <div v-if="activeLayer?.type === 'rect'">
            <label class="text-[10px] font-medium text-gray-500 mb-1 block">Corner Radius</label>
            <div class="flex items-center gap-2">
              <URange v-model="(activeLayer as any).rx" :min="0" :max="100" :step="1" size="sm" class="flex-1"
                @update:model-value="editor?.fabricCanvas?.requestRenderAll()" />
              <UInput v-model.number="(activeLayer as any).rx" type="number" size="xs"
                class="w-12 font-mono text-[10px]"
                @change="(activeLayer as any).ry = (activeLayer as any).rx; editor?.fabricCanvas?.requestRenderAll()" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col">
              <label class="text-[10px] font-medium text-gray-500 mb-1">Color</label>
              <UColorPicker v-model="stroke.color" @update:model-value="handleStrokeUpdate" />
            </div>

            <UFormField :label="t('adjust.stroke.style', 'Style')" size="xs">
              <USelect v-model="stroke.style" :options="strokeStyles" option-attribute="label" value-attribute="value"
                size="sm" @change="handleStrokeUpdate" />
            </UFormField>
          </div>
        </div>
      </template>

      <template #opacity>
        <div class="pb-2 pt-2">
          <div class="flex items-center gap-2">
            <URange v-model="opacity" :min="0" :max="100" :step="1" size="sm" class="flex-1"
              @update:model-value="handleOpacityUpdate" />
            <UInput v-model.number="opacity" type="number" size="xs" class="w-14 font-mono text-[10px]"
              @change="handleOpacityUpdate" />
          </div>
        </div>
      </template>

      <template #canvas>
        <div class="space-y-4 pb-2 pt-2">
          <UFormField :label="t('adjust.background.type', 'Type')" size="xs">
            <USelect v-model="background.type" :options="[
              { label: t('adjust.background.none', 'None'), value: 'none' },
              { label: t('adjust.background.solid', 'Solid'), value: 'solid' },
              { label: t('adjust.background.gradient', 'Gradient'), value: 'gradient' }
            ]" option-attribute="label" value-attribute="value" size="sm" @change="handleBackgroundUpdate" />
          </UFormField>

          <div v-if="background.type === 'solid'">
            <label class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Color</label>
            <UColorPicker v-model="background.solidColor" @update:model-value="handleBackgroundUpdate" />
          </div>

          <div v-if="background.type === 'gradient'" class="space-y-3">
            <UFormField :label="t('adjust.background.gradientType', 'Type')" size="xs">
              <USelect v-model="background.gradientType" :options="[
                { label: t('adjust.background.linear', 'Linear'), value: 'linear' },
                { label: t('adjust.background.radial', 'Radial'), value: 'radial' }
              ]" option-attribute="label" value-attribute="value" size="sm" @change="handleBackgroundUpdate" />
            </UFormField>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Color 1</label>
                <UColorPicker v-model="background.gradientColors[0]" @update:model-value="handleBackgroundUpdate" />
              </div>

              <div>
                <label class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Color 2</label>
                <UColorPicker v-model="background.gradientColors[1]" @update:model-value="handleBackgroundUpdate" />
              </div>
            </div>

            <div v-if="background.gradientType === 'linear'">
              <label class="text-[10px] font-medium text-gray-500 mb-1 block">Angle</label>
              <div class="flex items-center gap-2">
                <URange v-model="background.gradientAngle" :min="0" :max="360" :step="1" size="sm" class="flex-1"
                  @update:model-value="handleBackgroundUpdate" />
                <UInput v-model.number="background.gradientAngle" type="number" size="xs"
                  class="w-14 font-mono text-[10px]" @change="handleBackgroundUpdate" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </UAccordion>
  </section>
</template>
