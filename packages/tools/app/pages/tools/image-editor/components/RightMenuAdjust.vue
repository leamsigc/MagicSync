<script lang="ts" setup>
/**
 *
 * Canvas Editor
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { computed, watch, ref } from 'vue';
import { IText, type ITextProps } from 'fabric';
import { useFabricJs } from '../composables/useFabricJs';

interface TextAdjustmentProps {
  fontSize?: number;
  fontFamily?: string;
  fill?: string | null; // Allow null for fill
  fontWeight?: 'normal' | 'bold' | number | string; // Allow number for fontWeight
  fontStyle?: 'normal' | 'italic' | string;
  underline?: boolean;
  linethrough?: boolean;
  overline?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify' | string; // Allow string for textAlign
}

const { activeLayer, textSettings, updateTextSettings } = useFabricJs();

const isTextLayerActive = computed(() => activeLayer.value instanceof IText);

// Helper to extract relevant text properties from an IText object or ITextProps
const extractTextProps = (obj: IText | ITextProps | any): TextAdjustmentProps => { // Added any to bypass deep type checking
  const fillValue = typeof obj.fill === 'string' ? obj.fill : (obj.fill === null ? null : '#000000'); // Default to black if TFiller

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

// Local reactive state for form inputs, initialized from textSettings or activeLayer
const localTextSettings = ref<TextAdjustmentProps>(extractTextProps(textSettings.value as ITextProps)); // Explicitly cast

// Watch for changes in activeLayer to update localTextSettings
watch(activeLayer, (newVal) => {
  if (newVal instanceof IText) {
    localTextSettings.value = extractTextProps(newVal);
  }
}, { immediate: true });

// Watch for changes in localTextSettings to update the active FabricJS object
watch(localTextSettings, (newVal) => {
  if (isTextLayerActive.value) {
    updateTextSettings(newVal as ITextProps); // Cast to ITextProps as updateTextSettings expects it
  }
}, { deep: true });

const fontFamilies = [
  'Arial',
  'Verdana',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Palatino',
  'Garamond',
  'Comic Sans MS',
  'Trebuchet MS',
  'Arial Black',
  'Impact',
];

const textAlignOptions = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
  { label: 'Justify', value: 'justify' },
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
</script>

<template>
  <section>
    <div v-if="isTextLayerActive">
      <UFormField label="Font Size" class="mb-4">
        <UInput v-model.number="localTextSettings.fontSize" type="number"
          @change="updateTextSettings(localTextSettings as ITextProps)" />
      </UFormField>

      <UFormField label="Font Family" class="mb-4">
        <USelect v-model="localTextSettings.fontFamily" :options="fontFamilies"
          @change="updateTextSettings(localTextSettings as ITextProps)" />
      </UFormField>

      <UFormField label="Fill Color" class="mb-4">
        <UInput v-model="localTextSettings.fill" type="color"
          @change="updateTextSettings(localTextSettings as ITextProps)" />
      </UFormField>

      <UFormField label="Text Align" class="mb-4">
        <USelect v-model="localTextSettings.textAlign" :options="textAlignOptions" option-attribute="label"
          value-attribute="value" @change="updateTextSettings(localTextSettings as ITextProps)" />
      </UFormField>

      <div class="flex items-center gap-4 mb-4">
        <UCheckbox v-model="isBold" label="Bold" @change="updateTextSettings(localTextSettings as ITextProps)" />
        <UCheckbox v-model="isItalic" label="Italic" @change="updateTextSettings(localTextSettings as ITextProps)" />
        <UCheckbox v-model="localTextSettings.underline" label="Underline"
          @change="updateTextSettings(localTextSettings as ITextProps)" />
        <UCheckbox v-model="localTextSettings.linethrough" label="Strikethrough"
          @change="updateTextSettings(localTextSettings as ITextProps)" />
        <UCheckbox v-model="localTextSettings.overline" label="Overline"
          @change="updateTextSettings(localTextSettings as ITextProps)" />
      </div>
    </div>
    <div v-else>
      Adjust Editor
    </div>
  </section>
</template>
<style scoped></style>
