<script lang="ts" setup>
/**
 *
 * Component Description: A draggable text layer component using useDraggable.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { useDraggable } from '@vueuse/core';
import { ref, computed, watch, type CSSProperties } from 'vue';
import type { TextLayer } from '../composables/useTextStyles';


interface Props {
  layer: TextLayer;
  editorContainer: HTMLElement | null;
  isActive: boolean;
  selectedFontClass: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:activeTextLayerId']);

const el = ref<HTMLElement | null>(null);

// Initialize x, y based on layer's percentage position
const { x, y, style } = useDraggable(el, {
  // draggingElement: props.editorContainer || undefined,
  initialValue: computed(() => {
    if (props.editorContainer) {
      const containerWidth = props.editorContainer.offsetWidth;
      const containerHeight = props.editorContainer.offsetHeight;
      return {
        x: ((props.layer.positionX ?? 50) / 100) * containerWidth,
        y: ((props.layer.positionY ?? 50) / 100) * containerHeight, // ((props.layer.positionY[0] ?? 50) / 100) * containerHeight,
      };
    }
    return { x: 0, y: 0 };
  }),
  containerElement: props.editorContainer || undefined, // Pass the container element
  onMove: ({ x: newX, y: newY }) => {
    if (props.editorContainer) {
      const containerWidth = props.editorContainer.offsetWidth;
      const containerHeight = props.editorContainer.offsetHeight;

      // Convert pixel position to percentage and update layer
      props.layer.positionX = Math.max(0, Math.min(100, (newX / containerWidth) * 100));
      props.layer.positionY = Math.max(0, Math.min(100, (newY / containerHeight) * 100));
    }
  },
  onEnd: ({ x: newX, y: newY }) => {
    if (props.editorContainer) {
      const containerWidth = props.editorContainer.offsetWidth;
      const containerHeight = props.editorContainer.offsetHeight;

      // Convert pixel position to percentage and update layer
      props.layer.positionX = Math.max(0, Math.min(100, (newX / containerWidth) * 100));
      props.layer.positionY = Math.max(0, Math.min(100, (newY / containerHeight) * 100));
    }
  },
});

// Watch for external changes to layer.positionX/Y and update useDraggable's internal x/y
watch(
  [
    () => props.layer.positionX,
    () => props.layer.positionY,
    () => props.editorContainer,
  ],
  ([newPx, newPy]) => {
    if (props.editorContainer && newPx !== undefined && newPy !== undefined) {
      const containerWidth = props.editorContainer.offsetWidth;
      const containerHeight = props.editorContainer.offsetHeight;
      x.value = (newPx / 100) * containerWidth;
      y.value = (newPy / 100) * containerHeight;
    }
  },
  { immediate: true },
);
// Get text style
const getTextStyle = (layer: TextLayer) =>
  ({
    fontSize: `${layer.fontSize}px`,
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    textAlign: layer.textAlign,
    color: layer.color,
    transform: `scale(${layer.scale})`,
    textTransform: layer.textTransform,
    WebkitTextStroke: layer.textStroke,
    textShadow:
      layer.shadow.multiShadow ||
      (layer.shadow.enabled
        ? `${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${layer.shadow.blur}px ${layer.shadow.color}`
        : 'none'),
    background: layer.backgroundGradient,
    WebkitBackgroundClip:
      layer.backgroundClip === 'text' ? 'text' : 'border-box',
    WebkitTextFillColor:
      layer.backgroundClip === 'text' ? 'transparent' : 'inherit',
  }) as CSSProperties;

// The `style` from useDraggable will handle `left`, `top`, and `transform: translate(x,y)`
// We will apply zIndex directly in the template.
</script>

<template>
  <div ref="el" class="absolute flex items-center justify-center cursor-grab" :style="[style, { zIndex: layer.zIndex }]"
    :class="{ 'border-2 border-primary': isActive }" @click="emit('update:activeTextLayerId', layer.id)">
    <section :style="getTextStyle(layer)" class="bg-clip-text" :class="selectedFontClass">
      {{ layer.text }}
    </section>
  </div>
</template>
<style scoped>
/* Any specific styles for this component */
</style>
