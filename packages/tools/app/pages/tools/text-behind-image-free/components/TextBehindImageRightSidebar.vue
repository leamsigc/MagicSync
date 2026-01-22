<script lang="ts" setup>
/**
 * Right Sidebar with Tabbed Controls
 *
 * Comprehensive control panel for all editing features
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */
import {
  type TextLayer,
  type FontFamilies,
  type BackgroundControls,
  type TextStyle,
  useImageFilterStyles
} from '../composables/useTextStyles';

interface Props {
  textControls?: TextLayer;
  backgroundControls: BackgroundControls;
  fontFamilies: FontFamilies;
  selectedFontCategory: 'system' | 'google';
  stylesByCategory: Record<string, TextStyle[]>;
  customStyles: TextStyle[];
  optimizedOverlayImage: HTMLImageElement | null;
  imageFilter: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:text-controls': [value: TextLayer];
  'update:background-controls': [value: BackgroundControls];
  'update:selected-font-category': [value: 'system' | 'google'];
  'apply-text-style': [style: TextStyle];
  'save-current-as-custom-style': [name: string];
  'on-background-image-upload': [event: Event];
  'apply-filter-by-name': [name: string];
}>();

const activeTab = ref<'backdrop' | 'overlay' | 'effects' | 'filters' | 'auto' | 'upload' | 'strokes'>('backdrop');

const tabs = [
  { id: 'backdrop', label: 'Backdrop', icon: 'lucide:palette' },
  { id: 'overlay', label: 'Overlay', icon: 'lucide:layers' },
  { id: 'effects', label: 'Effects', icon: 'lucide:sparkles' },
  { id: 'filters', label: 'Filters', icon: 'lucide:filter' },
  { id: 'auto', label: 'Auto', icon: 'lucide:wand-2' },
  { id: 'upload', label: 'Upload', icon: 'lucide:upload' },
  { id: 'strokes', label: 'Strokes', icon: 'lucide:pen-tool' },
] as const;

// Import the image filter styles composable
const { presets } = useImageFilterStyles();

const newStyleName = ref('');
</script>

<template>
  <aside class="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
    <!-- Tab Navigation -->
    <div class="border-b border-gray-800 p-2">
      <div class="grid grid-cols-4 gap-1">
        <button v-for="tab in tabs" :key="tab.id" :class="[
          'px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex flex-col items-center gap-1',
          activeTab === tab.id
            ? 'bg-blue-500 text-white'
            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
        ]" @click="activeTab = tab.id">
          <Icon :name="tab.icon" class="w-4 h-4" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Backdrop Tab -->
      <div v-if="activeTab === 'backdrop'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Background</h3>

        <div class="space-y-3">
          <label class="text-xs text-gray-400">Type</label>
          <select v-model="backgroundControls.type"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            @change="emit('update:background-controls', backgroundControls)">
            <option value="none">None</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image</option>
            <option value="gradient-image">Gradient + Image</option>
          </select>
        </div>

        <div v-if="backgroundControls.type !== 'none'" class="space-y-3">
          <div v-if="backgroundControls.type === 'gradient' || backgroundControls.type === 'gradient-image'">
            <label class="text-xs text-gray-400">Gradient Colors</label>
            <div class="space-y-2 mt-2">
              <div v-for="(color, index) in backgroundControls.gradient.colors" :key="index" class="flex gap-2">
                <input v-model="backgroundControls.gradient.colors[index]" type="color"
                  class="w-10 h-10 rounded cursor-pointer"
                  @input="emit('update:background-controls', backgroundControls)">
                <input v-model="backgroundControls.gradient.colors[index]" type="text"
                  class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  @input="emit('update:background-controls', backgroundControls)">
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs text-gray-400">Opacity</label>
            <input v-model.number="backgroundControls.opacity[0]" type="range" min="0" max="1" step="0.1" class="w-full"
              @input="emit('update:background-controls', backgroundControls)">
            <div class="text-xs text-gray-500 text-right">{{ backgroundControls.opacity[0] }}</div>
          </div>
        </div>
      </div>

      <!-- Overlay Tab -->
      <div v-if="activeTab === 'overlay'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Image Layer</h3>

        <div v-if="optimizedOverlayImage" class="space-y-3">
          <div class="aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <img :src="optimizedOverlayImage.src" alt="Overlay" class="w-full h-full object-contain">
          </div>
          <p class="text-xs text-gray-400">Overlay image loaded</p>
        </div>
        <div v-else class="p-4 bg-gray-800 rounded-lg text-center text-sm text-gray-400">
          No overlay image
        </div>
      </div>

      <!-- Effects Tab -->
      <div v-if="activeTab === 'effects'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Text Effects</h3>

        <div v-if="textControls" class="space-y-4">
          <!-- Shadow Controls -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Shadow</label>
              <input v-model="textControls.shadow.enabled" type="checkbox" class="rounded"
                @change="emit('update:text-controls', textControls)">
            </div>

            <div v-if="textControls.shadow.enabled" class="space-y-2 pl-4">
              <div>
                <label class="text-xs text-gray-400">Color</label>
                <input v-model="textControls.shadow.color" type="color" class="w-full h-10 rounded cursor-pointer mt-1"
                  @input="emit('update:text-controls', textControls)">
              </div>
              <div>
                <label class="text-xs text-gray-400">Blur</label>
                <input v-model.number="textControls.shadow.blur" type="range" min="0" max="20" class="w-full"
                  @input="emit('update:text-controls', textControls)">
              </div>
            </div>
          </div>

          <!-- Text Presets -->
          <div class="space-y-3">
            <label class="text-xs text-gray-400">Text Styles</label>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="style in stylesByCategory.bold" :key="style.name"
                class="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-white transition-colors"
                @click="emit('apply-text-style', style)">
                {{ style.name }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="p-4 bg-gray-800 rounded-lg text-center text-sm text-gray-400">
          Select a text layer to edit
        </div>
      </div>

      <!-- Filters Tab -->
      <div v-if="activeTab === 'filters'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Image Filters</h3>

        <div class="grid grid-cols-2 gap-2">
          <button v-for="preset in presets" :key="preset.name" :class="[
            'px-3 py-2 rounded-lg text-xs font-medium transition-all',
            imageFilter === preset.name
              ? 'bg-blue-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          ]" @click="emit('apply-filter-by-name', preset.name)">
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Auto Tab -->
      <div v-if="activeTab === 'auto'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Auto Tools</h3>
        <div class="p-4 bg-gray-800 rounded-lg text-center text-sm text-gray-400">
          Background removal is applied automatically when you upload an image
        </div>
      </div>

      <!-- Upload Tab -->
      <div v-if="activeTab === 'upload'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Upload Image</h3>

        <label class="block">
          <div
            class="px-4 py-8 bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer transition-colors text-center">
            <Icon name="lucide:upload" class="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <span class="text-sm text-gray-400">Click to upload background image</span>
          </div>
          <input type="file" accept="image/*" class="hidden" @change="emit('on-background-image-upload', $event)">
        </label>
      </div>

      <!-- Strokes Tab -->
      <div v-if="activeTab === 'strokes'" class="space-y-4">
        <h3 class="text-sm font-semibold text-white">Text Stroke</h3>

        <div v-if="textControls" class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Enable Stroke</label>
            <input :checked="!!textControls.textStroke" type="checkbox" class="rounded"
              @change="textControls.textStroke = $event.target.checked ? { width: 1, color: '#000000' } : undefined; emit('update:text-controls', textControls)">
          </div>

          <div v-if="textControls.textStroke" class="space-y-3">
            <div>
              <label class="text-xs text-gray-400">Width</label>
              <input v-model.number="textControls.textStroke.width" type="range" min="0" max="10" class="w-full mt-1"
                @input="emit('update:text-controls', textControls)">
              <div class="text-xs text-gray-500 text-right">{{ textControls.textStroke.width }}px</div>
            </div>
            <div>
              <label class="text-xs text-gray-400">Color</label>
              <input v-model="textControls.textStroke.color" type="color"
                class="w-full h-10 rounded cursor-pointer mt-1" @input="emit('update:text-controls', textControls)">
            </div>
          </div>
        </div>
        <div v-else class="p-4 bg-gray-800 rounded-lg text-center text-sm text-gray-400">
          Select a text layer to edit
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Custom scrollbar */
aside::-webkit-scrollbar {
  width: 6px;
}

aside::-webkit-scrollbar-track {
  background: #1f2937;
}

aside::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

aside::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
