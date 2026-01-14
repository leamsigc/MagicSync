<i18n src="../ImageEditor.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Figma-style tools panel with ruler, alignment, and transform controls
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { useFabricJs } from '../composables/useFabricJs';

const { t } = useI18n();
const toast = useToast();
const {
  alignObjects,
  distributeObjects,
  flipHorizontal,
  flipVertical,
  rotateLeft,
  rotateRight,
  arrangeFront,
  arrangeBack,
  setPosition,
  addGuideline,
  removeGuideline,
  toggleRulers,
  toggleGuidelineSnap,
  toggleLayerVisibility,
  toggleLayerLock,
  zoomIn,
  zoomOut,
  editor
} = useFabricJs();

const showRulers = ref(false);
const snapToGuides = ref(true);
const guidelines = ref<Array<{ id: string; orientation: string; position: number }>>([]);

const position = ref({ x: 0, y: 0 });
const size = ref({ width: 0, height: 0 });
const lockAspect = ref(false);

const handleAddGuideline = (orientation: 'horizontal' | 'vertical') => {
  try {
    const position = orientation === 'horizontal' ? 100 : 100;
    const id = addGuideline(orientation, position);
    if (id) {
      guidelines.value.push({ id, orientation, position });
      toast.add({
        title: 'Guideline added',
        description: `${orientation} guideline at ${position}px`,
        color: 'primary',
        icon: 'lucide:check'
      });
    }
  } catch (error) {
    toast.add({ title: 'Failed to add guideline', color: 'error', icon: 'lucide:x' });
  }
};

const handleRemoveGuideline = (id: string) => {
  try {
    removeGuideline(id);
    guidelines.value = guidelines.value.filter(g => g.id !== id);
    toast.add({ title: 'Guideline removed', color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: 'Failed to remove guideline', color: 'error', icon: 'lucide:x' });
  }
};

const handleToggleRulers = () => {
  showRulers.value = !showRulers.value;
  toggleRulers(showRulers.value);
  toast.add({
    title: showRulers.value ? 'Rulers enabled' : 'Rulers disabled',
    color: 'neutral',
    icon: 'lucide:ruler'
  });
};

const handleToggleSnap = () => {
  snapToGuides.value = !snapToGuides.value;
  toggleGuidelineSnap(snapToGuides.value);
  toast.add({
    title: snapToGuides.value ? 'Snap enabled' : 'Snap disabled',
    color: 'neutral',
    icon: 'lucide:magnet'
  });
};

watch(() => editor.value?.fabricCanvas?.getActiveObject(), (activeObj) => {
  if (activeObj) {
    position.value = {
      x: Math.round(activeObj.left || 0),
      y: Math.round(activeObj.top || 0)
    };
    size.value = {
      width: Math.round((activeObj.width || 0) * (activeObj.scaleX || 1)),
      height: Math.round((activeObj.height || 0) * (activeObj.scaleY || 1))
    };
  }
});

const updatePosition = () => {
  try {
    setPosition(position.value.x, position.value.y);
    toast.add({ title: 'Position updated', color: 'primary', icon: 'lucide:check' });
  } catch (error) {
    toast.add({ title: 'Failed to update position', color: 'error', icon: 'lucide:x' });
  }
};

const handleVisibilityToggle = () => {
  const activeObj = editor.value?.fabricCanvas?.getActiveObject();
  if (activeObj) {
    toggleLayerVisibility(activeObj, activeObj.visible);
    toast.add({ title: activeObj.visible ? 'Layer visible' : 'Layer hidden', color: 'neutral' });
  }
};

const handleLockToggle = () => {
  const activeObj = editor.value?.fabricCanvas?.getActiveObject() as any;
  if (activeObj) {
    const isLocked = !activeObj.selectable;
    toggleLayerLock(activeObj, isLocked);
    toast.add({ title: isLocked ? 'Layer locked' : 'Layer unlocked', color: 'neutral' });
  }
};

</script>

<template>
  <section class="p-3 space-y-4 max-h-[600px] overflow-y-auto">
    <div class="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="lucide:ruler" class="w-4 h-4 text-gray-500" />
        <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {{ t('tools.ruler.title', 'Ruler & Guides') }}
        </h3>
      </div>

      <div class="space-y-2.5 pl-6">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-700 dark:text-gray-300">
            {{ t('tools.ruler.toggleRulers', 'Show Rulers') }}
          </span>
          <USwitch v-model="showRulers" @update:model-value="handleToggleRulers" size="xs" />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-700 dark:text-gray-300">{{ t('tools.ruler.snapToGuides', 'Snap to Guides')
            }}</span>
          <UToggle v-model="snapToGuides" @update:model-value="handleToggleSnap" size="xs" />
        </div>

        <div class="grid grid-cols-2 gap-2 pt-1">
          <UButton size="sm" variant="outline" @click="handleAddGuideline('horizontal')" icon="lucide:minus" block>
            {{ t('tools.ruler.addHorizontal', 'H Guide') }}
          </UButton>
          <UButton size="sm" variant="outline" @click="handleAddGuideline('vertical')" icon="lucide:separator-vertical"
            block>
            {{ t('tools.ruler.addVertical', 'V Guide') }}
          </UButton>
        </div>

        <div v-if="guidelines.length > 0" class="space-y-1 pt-2">
          <div v-for="guide in guidelines" :key="guide.id"
            class="flex items-center justify-between text-xs p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <span class="text-gray-600 dark:text-gray-400">{{ guide.orientation }} @ {{ guide.position }}px</span>
            <UButton size="xs" variant="ghost" icon="lucide:x" @click="handleRemoveGuideline(guide.id)" />
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="lucide:search" class="w-4 h-4 text-gray-500" />
        <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Zoom
        </h3>
      </div>
      <div class="pl-6">
        <div
          class="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-md border border-gray-200 dark:border-gray-800">
          <UButton size="xs" variant="ghost" icon="lucide:zoom-out" @click="zoomOut" />
          <div class="flex-1 text-center font-mono text-[10px] text-gray-600 dark:text-gray-400">
            {{ Math.round((editor?.fabricCanvas?.getZoom() || 1) * 100) }}%
          </div>
          <UButton size="xs" variant="ghost" icon="lucide:zoom-in" @click="zoomIn" />
        </div>
      </div>
    </div>

    <div class="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="lucide:layout-grid" class="w-4 h-4 text-gray-500" />
        <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Alignment
        </h3>
      </div>

      <div class="pl-6 space-y-4">
        <div class="grid grid-cols-3 gap-1">
          <UButton icon="lucide:align-start-vertical" variant="outline" size="sm" @click="alignObjects('left')" />
          <UButton icon="lucide:align-center-vertical" variant="outline" size="sm" @click="alignObjects('center')" />
          <UButton icon="lucide:align-end-vertical" variant="outline" size="sm" @click="alignObjects('right')" />
          <UButton icon="lucide:align-start-horizontal" variant="outline" size="sm" @click="alignObjects('top')" />
          <UButton icon="lucide:align-center-horizontal" variant="outline" size="sm" @click="alignObjects('middle')" />
          <UButton icon="lucide:align-end-horizontal" variant="outline" size="sm" @click="alignObjects('bottom')" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <UButton size="xs" variant="ghost" @click="distributeObjects('horizontal')"
            icon="lucide:distribute-horizontal" class="text-[10px]">
            H-Dist
          </UButton>
          <UButton size="xs" variant="ghost" @click="distributeObjects('vertical')" icon="lucide:distribute-vertical"
            class="text-[10px]">
            V-Dist
          </UButton>
        </div>
      </div>
    </div>

    <div class="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="lucide:move" class="w-4 h-4 text-gray-500" />
        <h3 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Transform
        </h3>
      </div>

      <div class="pl-6 space-y-4">
        <div class="grid grid-cols-4 gap-1">
          <UButton size="xs" variant="outline" @click="flipHorizontal" icon="lucide:flip-horizontal" />
          <UButton size="xs" variant="outline" @click="flipVertical" icon="lucide:flip-vertical" />
          <UButton size="xs" variant="outline" @click="rotateLeft" icon="lucide:rotate-ccw" />
          <UButton size="xs" variant="outline" @click="rotateRight" icon="lucide:rotate-cw" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UButton size="xs" variant="ghost" @click="arrangeFront" icon="lucide:bring-to-front" class="text-[10px]">
            Bring Front</UButton>
          <UButton size="xs" variant="ghost" @click="arrangeBack" icon="lucide:send-to-back" class="text-[10px]">Send
            Back</UButton>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ t('tools.transform.position', 'Position') }}
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">X</label>
              <UInput v-model.number="position.x" type="number" size="sm" @change="updatePosition" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">Y</label>
              <UInput v-model.number="position.y" type="number" size="sm" @change="updatePosition" />
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ t('tools.transform.size', 'Size') }}
            </label>
            <USwitch v-model="lockAspect" size="xs">
              <template #label>
                <span class="text-[10px]">Lock</span>
              </template>
            </USwitch>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">W</label>
              <UInput v-model.number="size.width" type="number" size="sm" disabled />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">H</label>
              <UInput v-model.number="size.height" type="number" size="sm" disabled />
            </div>
          </div>
        </div>

        <div v-if="editor?.fabricCanvas?.getActiveObject()" class="space-y-2 pt-2">
          <label class="text-xs font-medium text-gray-700 dark:text-gray-300 block">Object States</label>
          <div class="flex gap-2">
            <UButton v-if="editor?.fabricCanvas?.getActiveObject()" size="sm" variant="outline"
              :icon="editor?.fabricCanvas?.getActiveObject()?.visible ? 'lucide:eye' : 'lucide:eye-off'" class="flex-1"
              @click="editor!.fabricCanvas!.getActiveObject()!.visible = !editor!.fabricCanvas!.getActiveObject()!.visible; handleVisibilityToggle()" />
            <UButton size="sm" variant="outline"
              :icon="editor?.fabricCanvas?.getActiveObject()?.selectable ? 'lucide:unlock' : 'lucide:lock'"
              class="flex-1" @click="handleLockToggle()" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
