<script lang="ts" setup>
import TextBehindImageEditor from './TextBehindImageEditor.vue';
import TextBehindImageCanvasPresets from "./TextBehindImageCanvasPresets.vue"
import TextBehindImageRightSidebar from "./TextBehindImageRightSidebar.vue"
import {
  useTextStyles,
  useImageFilterStyles,
  type TextLayer,
  type BackgroundControls,
  type FontFamilies,
  type TextStyle,
  type AspectRatios,
} from '../composables/useTextStyles';

/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
interface EditorProps {
  text?: string;
  baseImage: HTMLImageElement | null;
  overlayImage: HTMLImageElement | null;
  textOverImage: boolean;
}

const { isRunning, run, result, start, progress } = useImageTransformer();
const viewState = ref<'EDITING' | 'PREVIEW' | 'REMOVE_BG'>('REMOVE_BG');

const files = ref<File[]>([]);

const originalImage = ref<File[]>([]);

const isLoading = ref(false);
const isProcessing = ref(false);

const editorProps = ref<EditorProps>({
  text: 'Hello World',
  baseImage: null,
  overlayImage: null,
  textOverImage: false,
});

// Sidebar State
const { stylesByCategory, customStyles, addCustomStyle } = useTextStyles();

const textControls = ref<TextLayer>({
  id: 'text-1',
  text: 'Hello World',
  fontSize: 72,
  fontFamily: 'Roboto, sans-serif',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textAlign: 'center',
  color: '#FFFFFF',
  shadow: {
    enabled: true,
    color: '#000000',
    blur: 4,
    offsetX: 2,
    offsetY: 2,
  },
  scale: 1,
  positionX: 0,
  positionY: 0,
  zIndex: 1,
});

const backgroundControls = ref<BackgroundControls>({
  type: 'none',
  gradient: {
    direction: 'to right',
    colors: ['#3b82f6', '#8b5cf6'],
  },
  image: null,
  opacity: [1],
  predefinedBackgrounds: [],
});

const fontFamilies = ref<FontFamilies>({
  system: [
    { name: 'Arial', family: 'Arial, sans-serif', cssClass: 'font-arial' },
    { name: 'Times New Roman', family: '"Times New Roman", serif', cssClass: 'font-times' },
    { name: 'Courier New', family: '"Courier New", monospace', cssClass: 'font-courier' },
    { name: 'Georgia', family: 'Georgia, serif', cssClass: 'font-georgia' },
    { name: 'Verdana', family: 'Verdana, sans-serif', cssClass: 'font-verdana' },
  ],
  google: [
    { name: 'Roboto', family: 'Roboto, sans-serif', cssClass: 'font-roboto' },
    { name: 'Open Sans', family: '"Open Sans", sans-serif', cssClass: 'font-open-sans' },
    { name: 'Lato', family: 'Lato, sans-serif', cssClass: 'font-lato' },
    { name: 'Montserrat', family: 'Montserrat, sans-serif', cssClass: 'font-montserrat' },
    { name: 'Poppins', family: 'Poppins, sans-serif', cssClass: 'font-poppins' },
    { name: 'Playfair Display', family: '"Playfair Display", serif', cssClass: 'font-playfair-display' },
    { name: 'Oswald', family: '"Oswald", sans-serif', cssClass: 'font-oswald' },
    { name: 'Bebas Neue', family: '"Bebas Neue", sans-serif', cssClass: 'font-bebas-neue' },
    { name: 'Anton', family: '"Anton", sans-serif', cssClass: 'font-anton' },
    { name: 'Raleway', family: '"Raleway", sans-serif', cssClass: 'font-raleway' },
    { name: 'Lobster', family: '"Lobster", cursive', cssClass: 'font-lobster' },
    { name: 'Pacifico', family: '"Pacifico", cursive', cssClass: 'font-pacifico' },
    { name: 'Abril Fatface', family: '"Abril Fatface", serif', cssClass: 'font-abril-fatface' },
    { name: 'Bungee', family: '"Bungee", cursive', cssClass: 'font-bungee' },
    { name: 'Fredoka One', family: '"Fredoka One", sans-serif', cssClass: 'font-fredoka-one' },
  ]
});

const selectedFontCategory = ref<'system' | 'google'>('system');
const imageFilter = ref('None');

const aspectRatios = ref<AspectRatios>({
  '1:1': { width: 1080, height: 1080, label: 'Square' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait' },
  '16:9': { width: 1920, height: 1080, label: 'Landscape' },
  '9:16': { width: 1080, height: 1920, label: 'Story' },
  '1200:628': { width: 1200, height: 628, label: 'FB Share' },
  '851:315': { width: 851, height: 315, label: 'FB Cover' },
  '1500:500': { width: 1500, height: 500, label: 'Twitter Header' },
  '1024:512': { width: 1024, height: 512, label: 'Twitter Post' },
  '1584:396': { width: 1584, height: 396, label: 'LinkedIn Cover' },
  '1200:627': { width: 1200, height: 627, label: 'LinkedIn Post' },
  'custom': { width: 1080, height: 1080, label: 'Custom' },
  'image': { width: 0, height: 0, label: 'Original' },
});

const aspectRatio = ref<keyof AspectRatios>('1:1');

type ImageStatus = {
  id: number;
  isLoading: boolean;
};

const imageStatuses = ref<ImageStatus[]>([]);

const optimizedOverlayImage = computed(() => {
  return editorProps.value.overlayImage;
});

const updateTextControls = (newControls: TextLayer) => {
  textControls.value = newControls;
  // Sync with editorProps text if needed
  if (editorProps.value) {
    editorProps.value.text = newControls.text;
  }
};

const updateBackgroundControls = (newControls: BackgroundControls) => {
  backgroundControls.value = newControls;
};

const applyTextStyle = (style: TextStyle) => {
  if (textControls.value) {
    // Create a new object to trigger reactivity, preserving layout props
    const { scale, positionX, positionY, zIndex, ...styleProps } = style.style;

    textControls.value = {
      ...textControls.value,
      ...styleProps,
    };
  }
};

const saveCurrentAsCustomStyle = (name: string) => {
  if (textControls.value) {
    const {
      text, fontSize, fontFamily, fontWeight, fontStyle, textAlign, color,
      textTransform, textStroke, backgroundGradient, backgroundClip, shadow
    } = textControls.value;

    addCustomStyle({
      name,
      style: {
        text, fontSize, fontFamily, fontWeight, fontStyle, textAlign, color,
        textTransform, textStroke, backgroundGradient, backgroundClip, shadow: { ...shadow },
        scale: 1
      },
      category: 'custom'
    });
  }
};

const onBackgroundImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const url = URL.createObjectURL(file);
    backgroundControls.value.image = url;
    if (backgroundControls.value.type === 'none' || backgroundControls.value.type === 'gradient') {
      backgroundControls.value.type = 'image';
    }
  }
};

const applyFilterByName = (name: string) => {
  imageFilter.value = name;
};

const updateAspectRatio = (ratio: keyof AspectRatios) => {
  aspectRatio.value = ratio;
};

const getPreview = (file: File) => {
  return URL.createObjectURL(file);
};

const removeBg = async (file: File, i: number) => {
  if (imageStatuses.value[i]) {
    imageStatuses.value[i].isLoading = true;
  }
  try {
    await run(file);
    originalImage.value.push(file);
  } catch (error) {
    console.error('Error removing background:', error);
  } finally {
    if (imageStatuses.value[i]) {
      imageStatuses.value[i].isLoading = false;
    }
  }
};
const editImage = () => {
  viewState.value = 'EDITING';
  const baseImage = new Image();
  const baseFile = originalImage.value[0];
  baseImage.src = URL.createObjectURL(baseFile as File);

  editorProps.value.baseImage = baseImage;

  const overlayImage = new Image();
  overlayImage.src = URL.createObjectURL(result.value[0] as File);
  editorProps.value.overlayImage = overlayImage;

  editorProps.value.textOverImage = true;
};

onMounted(async () => {
  await start();
});

const onFileDrop = async (f: File | null | undefined) => {
  const isSingleFile = f instanceof File;

  if (isSingleFile) {
    files.value.push(f);
    imageStatuses.value.push({
      id: Date.now(),
      isLoading: false,
    })

    if (files.value.length) {
      console.log('Removing bg ');
      removeBg(files.value[0] as File, 0);
      isProcessing.value = false;
      viewState.value = 'PREVIEW';
    }
  }
};

const isAnyImageInProgress = computed(() => {
  return imageStatuses.value.some((status) => status.isLoading);
});

const clear = () => {
  files.value = [];
  result.value = [];
  originalImage.value = [];
  imageStatuses.value = [];
  editorProps.value.baseImage = null;
  editorProps.value.overlayImage = null;
  editorProps.value.textOverImage = false;
  viewState.value = 'REMOVE_BG';
};

const backgroundType = ref('gradient'); // Default to gradient

const benefits = ref([
  {
    icon: 'lucide:blocks',
    title: 'Drag & Drop a image to edit',
    description: 'Select the base image for the text over image',
  },
  {
    icon: 'lucide:file-image',
    title: 'Background Remover',
    description: 'The background of the original image will be removed',
  },
  {
    icon: 'lucide:text',
    title: 'Add Text',
    description: 'Provide the text for the image',
  },
  {
    icon: 'lucide:edit',
    title: 'Edit Text',
    description: 'Edit the text over the image',
  },
  {
    icon: 'lucide:download',
    title: 'Download',
    description:
      'When you are done editing, you can download the image with the text over it',
  },
]);
</script>

<template>
  <section class=" w-full">
    <BaseHeader />
    <BaseBenefits :items="benefits">
      <template #title>
        How it works
      </template>
      <template #subtitle>
        Step by step guide
      </template>
      <template #description>
        This tool will remove the background from the image and add the text over it.
        then you can edit text and save the result.
      </template>
    </BaseBenefits>

    <div class="min-h-screen flex flex-col overflow-hidden w-full">
      <!-- Main Content Area -->
      <div class="flex flex-1 overflow-hidden w-full">
        <TextBehindImageRightSidebar :textControls="textControls" :backgroundControls="backgroundControls"
          :fontFamilies="fontFamilies" :selectedFontCategory="selectedFontCategory" :stylesByCategory="stylesByCategory"
          :customStyles="customStyles" :optimizedOverlayImage="optimizedOverlayImage" :imageFilter="imageFilter"
          @update:text-controls="updateTextControls" @update:background-controls="updateBackgroundControls"
          @update:selected-font-category="selectedFontCategory = $event" @apply-text-style="applyTextStyle"
          @save-current-as-custom-style="saveCurrentAsCustomStyle" @on-background-image-upload="onBackgroundImageUpload"
          @apply-filter-by-name="applyFilterByName" />
        <!-- Center Canvas Area -->
        <main
          class="flex-1 flex items-center justify-center p-8 md:p-12 lg:p-16 bg-linear-to-br from-info via-primary to-secondary relative overflow-hidden">
          <!-- Outer Glow / Background Element -->
          <div class="absolute inset-0 bg-linear-to-br from-info to-primary opacity-50 blur-3xl" />

          <!-- Canvas Representation -->
          <div
            class="w-full h-full bg-gray-800/60  border border-gray-600/50 rounded-2xl shadow-2xl relative canvas-grid flex items-center justify-center">

            <!-- Loading Overlay -->
            <div v-if="isLoading || isAnyImageInProgress"
              class="absolute inset-0 bg-gray-800/80  flex items-center justify-center rounded-2xl z-10">
              <div class="flex flex-col items-center space-y-4 text-gray-300">
                <Icon name="svg-spinners:270-ring-with-bg" class="w-10 h-10" />
                <span>Loading model & processing image</span>
              </div>
            </div>

            <!-- Screenshot Input Modal -->
            <div v-if="!isLoading && (viewState === 'REMOVE_BG' || !files.length)"
              class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2   p-5 rounded-xl  w-96 text-sm flex flex-col items-center space-y-4">
              <UFileUpload accept="image/*" label="Drop your image here" description="SVG, PNG, JPG or GIF (max. 2MB)"
                :multiple="false" class="w-96 min-h-80" @update:modelValue="onFileDrop" />
            </div>

            <!-- Preview Area -->
            <div v-if="viewState === 'PREVIEW'" class="grid place-items-center md:grid-cols-1 py-8 mt-8 ">
              <!-- Loading Indicator -->
              <div v-if="isRunning || result.length === 0"
                class="flex flex-col items-center justify-center space-y-4 text-gray-300">
                <Icon name="svg-spinners:270-ring-with-bg" class="w-10 h-10" />
                <span>Processing image...</span>
              </div>

              <!-- Image Preview -->
              <section v-for="(file, index) in result" v-if="result.length > 0" :key="file.name" class="relative">
                <NuxtImg :key="file.name" :src="getPreview(file)" alt="base image" class="rounded max-h-screen" />
                <div v-if="isRunning"
                  class="absolute inset-0 bg-slate-950/80 text-blue-50 dark:bg-slate-950/60 flex items-center justify-center">
                  <Icon name="svg-spinners:270-ring-with-bg" />
                  <div class="ml-5">Removing background ...</div>
                </div>
                <section class="absolute inset-0 grid place-content-center">
                  <UButton @click="editImage">Use image</UButton>
                </section>
              </section>
            </div>

            <!-- Fabric Editor Area -->
            <section v-if="viewState === 'EDITING'" class="min-h-full min-w-full  mt-5">
              <TextBehindImageEditor v-if="editorProps.baseImage && editorProps.overlayImage && editorProps.text"
                :base-image="editorProps.baseImage" :overlay-image="editorProps.overlayImage" :text="editorProps.text"
                :text-over-image="editorProps.textOverImage" v-model:activeLayer="textControls"
                v-model:backgroundConfig="backgroundControls" @reset="clear" />
            </section>

          </div>


        </main>

        <TextBehindImageCanvasPresets :aspectRatios="aspectRatios" :aspectRatio="aspectRatio"
          @update:aspect-ratio="updateAspectRatio" />
      </div>
    </div>
  </section>
</template>
<style scoped>
/* Optional: Add custom styles or overrides if needed */
/* Style for the canvas grid background */
.canvas-grid {
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  /* Adjust grid size */
}

/* Custom scrollbar for webkit browsers */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #2d3748;
  /* gray-800 */
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #4a5568;
  /* gray-600 */
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #718096;
  /* gray-500 */
}



.font-roboto {
  font-family: Roboto, sans-serif;

}


.font-open-sans {
  font-family: "Open Sans", sans-serif;
}


.font-lato {
  font-family: Lato, sans-serif;

}


.font-montserrat {
  font-family: Montserrat, sans-serif;
}


.font-poppins {
  font-family: Poppins, sans-serif;
}

.font-meta {
  font-family: "Meta", sans-serif;
}


.font-playfair-display {
  font-family: "Playfair Display", serif
}



.font-sigmar {
  font-family: "Sigmar", serif;
}


.font-rancho {
  font-family: Rancho, cursive,
}

.font-oswald {
  font-family: "Oswald", sans-serif;
}


.font-bebas-neue {
  font-family: "Bebas Neue", sans-serif;
}

.font-anton {
  font-family: "Anton", sans-serif;
}


.font-playfair-display {

  font-family: "Playfair Display", serif;
}

.font-raleway {
  font-family: "Raleway", sans-serif;
}

.font-bungee {
  font-family: "Bungee", cursive;
}

.font-abril-fatface {
  font-family: "Abril Fatface", serif;
}


.font-fredoka-one {
  font-family: "Fredoka One", sans-serif;
}

.font-amatic-sc {
  font-family: "Amatic SC", cursive;
}


.font-lobster {
  font-family: "Lobster", cursive;
}

.font-unica-one {
  font-family: "Unica One", sans-serif;
}


.font-orbitron {
  font-family: "Orbitron", sans-serif;
}

.font-exo-2 {
  font-family: "Exo 2", sans-serif;
}

.font-chivo {
  font-family: "Chivo", sans-serif;
}

.font-cinzel {
  font-family: "Cinzel", serif;
}


.font-bangers {
  font-family: "Bangers", cursive,
}
</style>
