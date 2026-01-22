<script lang="ts" setup>
import TextBehindImageEditor from './TextBehindImageEditor.vue';

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


type ImageStatus = {
  id: number;
  isLoading: boolean;
};

const imageStatuses = ref<ImageStatus[]>([]);


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
    <BaseBenefits :items="benefits" v-if="viewState === 'REMOVE_BG'">
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
                :text-over-image="editorProps.textOverImage" @reset="clear" />
            </section>

          </div>
        </main>
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
