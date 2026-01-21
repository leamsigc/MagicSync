<script lang="ts" setup>
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
import TextBehindImageTextLayer from './TextBehindImageTextLayer.vue';
import TextBehindImageEditorControls from './TextBehindImageEditorControls.vue';
import { domToPng } from 'modern-screenshot';
import { useMediaQuery } from '@vueuse/core';
import {
  useTextStyles,
  useImageFilterStyles,
  type TextLayer,
  type FontFamilies,
  type AspectRatios,
  type BackgroundControls,
  type FontItem,
  type TextStyle,
} from '../composables/useTextStyles';
import type { CSSProperties } from 'vue';
interface Props {
  text?: string;
  baseImage?: HTMLImageElement;
  overlayImage?: HTMLImageElement;
  textOverImage?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  textOverImage: false,
});

const emit = defineEmits(['update:text', 'reset']);

const textLayers = ref<TextLayer[]>([]);
const activeTextLayerId = ref<string | null>(null);

const activeTextLayer = computed<TextLayer | undefined>(() => {
  return textLayers.value.find(
    (layer: TextLayer) => layer.id === activeTextLayerId.value,
  );
});

const addTextLayer = (layerText = 'New Text Layer') => {
  const newLayer: TextLayer = {
    id: `text-layer-${Date.now()}`,
    text: layerText,
    fontSize: 64,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#FFFFFF',
    textTransform: undefined,
    textStroke: undefined,
    backgroundGradient: undefined,
    backgroundClip: undefined,
    shadow: {
      enabled: true,
      color: '#000000',
      multiShadow: undefined,
      blur: 4,
      offsetX: 2,
      offsetY: 2,
    },
    scale: 1,
    positionX: 50, // Default to center
    positionY: 50, // Default to center
    zIndex: 1, // Default z-index
  };
  textLayers.value.push(newLayer);
  activeTextLayerId.value = newLayer.id;
};

const deleteTextLayer = (id: string) => {
  const remainingLayers = textLayers.value.filter(
    (layer: TextLayer) => layer.id !== id,
  );
  if (activeTextLayerId.value === id) {
    const newActiveLayer = remainingLayers[0];
    if (newActiveLayer) {
      activeTextLayerId.value = newActiveLayer.id;
    } else {
      activeTextLayerId.value = null;
    }
  }
  textLayers.value = remainingLayers;
  if (textLayers.value.length === 0) {
    addTextLayer(); // Add a new layer if all are deleted
  }
};
addTextLayer();
// Initialize with one text layer if no text is provided, or with the provided text
onMounted(() => {
  if (textLayers.value.length === 0) {
    addTextLayer();
  }
});

// Writable computed property for text controls
const textControls = computed<TextLayer | undefined>({
  get() {
    return activeTextLayer.value;
  },
  set(newValue) {
    if (activeTextLayer.value && newValue) {
      Object.assign(activeTextLayer.value, newValue);
      emit('update:text', newValue.text);
    }
  },
});

// Replace the existing fontFamilies array with these font categories
const fontFamilies: FontFamilies = {
  system: [
    // Sans-serif fonts
    { cssClass: 'arial', name: 'Arial', family: 'Arial, sans-serif' },
    {
      cssClass: 'helvetica',
      name: 'Helvetica',
      family: 'Helvetica, sans-serif',
    },
    { cssClass: 'verdana', name: 'Verdana', family: 'Verdana, sans-serif' },
    { cssClass: 'tahoma', name: 'Tahoma', family: 'Tahoma, sans-serif' },
    {
      cssClass: 'trebuchet',
      name: 'Trebuchet MS',
      family: '"Trebuchet MS", sans-serif',
    },
    { cssClass: 'system', name: 'System UI', family: 'system-ui, sans-serif' },

    // Serif fonts
    {
      cssClass: 'times',
      name: 'Times New Roman',
      family: '"Times New Roman", serif',
    },
    { cssClass: 'georgia', name: 'Georgia', family: 'Georgia, serif' },
    { cssClass: 'garamond', name: 'Garamond', family: 'Garamond, serif' },

    // Monospace fonts
    {
      cssClass: 'courier',
      name: 'Courier New',
      family: '"Courier New", monospace',
    },
    { cssClass: 'consolas', name: 'Consolas', family: 'Consolas, monospace' },

    // Fantasy/Decorative
    { cssClass: 'impact', name: 'Impact', family: 'Impact, fantasy' },
    {
      cssClass: 'comic',
      name: 'Comic Sans MS',
      family: '"Comic Sans MS", cursive',
    },
  ],
  google: [
    { cssClass: 'roboto', name: 'Roboto', family: 'Roboto, sans-serif' },
    { cssClass: 'open', name: 'Open Sans', family: '"Open Sans", sans-serif' },
    { cssClass: 'lato', name: 'Lato', family: 'Lato, sans-serif' },
    {
      cssClass: 'montserrat',
      name: 'Montserrat',
      family: 'Montserrat, sans-serif',
    },
    { cssClass: 'poppins', name: 'Poppins', family: 'Poppins, sans-serif' },
    {
      cssClass: 'playfair',
      name: 'Playfair Display',
      family: '"Playfair Display", serif',
    },
    // Add fonts from presets
    { cssClass: 'sigmar', name: 'Sigmar', family: ' "Sigmar", serif' },
    { cssClass: 'rancho', name: 'Rancho', family: 'Rancho, cursive' },
    { cssClass: 'oswald', name: 'Oswald', family: '"Oswald", sans-serif' },
    {
      cssClass: 'bebas',
      name: 'Bebas Neue',
      family: '"Bebas Neue", sans-serif',
    },
    { cssClass: 'anton', name: 'Anton', family: '"Anton", sans-serif' },
    {
      cssClass: 'playfair-display',
      name: 'Playfair Display',
      family: '"Playfair Display", serif',
    },
    { cssClass: 'relayway', name: 'Raleway', family: '"Raleway", sans-serif' },
    { cssClass: 'bungee', name: 'Bungee', family: '"Bungee", cursive' },
    {
      cssClass: 'abril',
      name: 'Abril Fatface',
      family: '"Abril Fatface", serif',
    },
    {
      cssClass: 'fredoka',
      name: 'Fredoka One',
      family: '"Fredoka One", sans-serif',
    },
    { cssClass: 'amatic', name: 'Amatic SC', family: '"Amatic SC", cursive' },
    { cssClass: 'lobster', name: 'Lobster', family: '"Lobster", cursive' },
    { cssClass: 'unica', name: 'Unica One', family: '"Unica One", sans-serif' },
    {
      cssClass: 'orbitron',
      name: 'Orbitron',
      family: '"Orbitron", sans-serif',
    },
    { cssClass: 'exo', name: 'Exo 2', family: '"Exo 2", sans-serif' },
    { cssClass: 'chivo', name: 'Chivo', family: '"Chivo", sans-serif' },
    { cssClass: 'cinzel', name: 'Cinzel', family: '"Cinzel", serif' },
    { cssClass: 'bangers', name: 'Bangers', family: '"Bangers", cursive' },
    // Popular Google Fonts
  ],
};

// Add state for selected font category
const selectedFontCategory = ref<'system' | 'google'>('system');

// Aspect Ratio
const aspectRatio = ref<keyof AspectRatios>('1:1');
const aspectRatios: AspectRatios = {
  // Social Media Sizes
  '1:1': { width: 1080, height: 1080, label: 'Instagram Square' },
  '4:5': { width: 1080, height: 1350, label: 'Instagram Portrait' },
  '16:9': { width: 1920, height: 1080, label: 'Instagram Landscape' },
  '9:16': { width: 1080, height: 1920, label: 'Instagram Story' },
  // Facebook Sizes
  '1200:628': { width: 1200, height: 628, label: 'Facebook Share' },
  '851:315': { width: 851, height: 315, label: 'Facebook Cover' },
  // Twitter Sizes
  '1500:500': { width: 1500, height: 500, label: 'Twitter Header' },
  '1024:512': { width: 1024, height: 512, label: 'Twitter Post' },
  // LinkedIn Sizes
  '1584:396': { width: 1584, height: 396, label: 'LinkedIn Cover' },
  '1200:627': { width: 1200, height: 627, label: 'LinkedIn Post' },
  // Custom & Image Based
  custom: { width: 800, height: 600, label: 'Custom Size' },
  image: { width: 0, height: 0, label: 'Based on Image' },
};

// Add these new controls
const customSize = reactive({
  width: 800,
  height: 600,
});

// Add computed for actual dimensions
const actualDimensions = computed(() => {
  if (aspectRatio.value === 'image' && props.baseImage) {
    return {
      width: props.baseImage.naturalWidth,
      height: props.baseImage.naturalHeight,
    };
  }
  if (aspectRatio.value === 'custom') {
    return customSize;
  }
  return aspectRatios[aspectRatio.value];
});

// Add watcher for base image to update dimensions
watch(
  () => props.baseImage,
  (newImage) => {
    if (aspectRatio.value === 'image' && newImage) {
      // Wait for image to load to get natural dimensions
      newImage.onload = () => {
        customSize.width = newImage.naturalWidth;
        customSize.height = newImage.naturalHeight;
      };
    }
  },
);

const downloadCanvas = async () => {
  const container = document.querySelector('#editor-container');
  if (!container) return;

  const originalActiveTextLayerId = activeTextLayerId.value;
  activeTextLayerId.value = null;

  // Wait for the DOM to update after removing the outline
  await nextTick();

  domToPng(container, {
    quality: 1,
    width: scaledDimensions.value.width,
    height: scaledDimensions.value.height,
    maximumCanvasSize: 10000,
    timeout: 300000,
  })
    .then((dataUrl) => {
      // Create a link to download the image
      const link = document.createElement('a');
      link.download = 'screen-shot.png';
      link.href = dataUrl;
      link.click();
    })
    .finally(() => {
      // Restore the active text layer after download
      activeTextLayerId.value = originalActiveTextLayerId;
    });
};

const activePosition = ref({ top: '0', left: '0' });

const positions = ref<{ top: string; left: string }[]>([
  // Top row
  { top: '0', left: '0' },
  { top: '0', left: '20' },
  { top: '0', left: '50' },
  { top: '0', left: '60' },
  { top: '0', left: '80' },
  // Second row
  { top: '20', left: '0' },
  { top: '20', left: '20' },
  { top: '20', left: '50' },
  { top: '20', left: '60' },
  { top: '20', left: '80' },
  //Center
  { top: '50', left: '0' },
  { top: '50', left: '20' },
  { top: '50', left: '50' },
  { top: '50', left: '60' },
  { top: '50', left: '80' },
  //Bottom second
  { top: '60', left: '0' },
  { top: '60', left: '20' },
  { top: '60', left: '50' },
  { top: '60', left: '60' },
  { top: '60', left: '80' },
  //Last
  { top: '80', left: '0' },
  { top: '80', left: '20' },
  { top: '80', left: '50' },
  { top: '80', left: '60' },
  { top: '80', left: '80' },
]);

const HandlePredefinedPosition = (position: { top: string; left: string }) => {
  if (activeTextLayer.value) {
    activePosition.value = position;
    activeTextLayer.value.positionX = parseInt(position.left);
    activeTextLayer.value.positionY = parseInt(position.top);
  }
};

// Add these new controls after the existing ones
const backgroundControls = ref<BackgroundControls>({
  type: 'none', // 'none' | 'gradient' | 'image' | 'gradient-image'
  gradient: {
    direction: '45deg',
    colors: ['#4158D0', '#C850C0', '#FFCC70'],
  },
  image: null,
  opacity: [1],
  predefinedBackgrounds: [
    {
      type: 'gradient',
      name: 'Blue Purple',
      gradient: {
        direction: '45deg',
        colors: ['#4158D0', '#C850C0', '#FFCC70'],
      },
    },
    {
      type: 'gradient',
      name: 'Ocean Blue',
      gradient: {
        direction: '90deg',
        colors: ['#2E3192', '#1BFFFF'],
      },
    },
    {
      type: 'gradient-image',
      name: 'Abstract Pattern',
      gradient: {
        direction: '45deg',
        colors: ['#4158D0aa', '#C850C0aa'],
      },
      image: '/backgrounds/abstract-1.jpg',
    },
    // Add more predefined backgrounds...
  ],
});

// Add computed for background style
const backgroundStyle = computed(() => {
  const styles: Record<string, string> = {};

  switch (backgroundControls.value.type) {
    case 'gradient':
      styles.background = `linear-gradient(${backgroundControls.value.gradient.direction}, ${backgroundControls.value.gradient.colors.join(', ')})`;
      break;
    case 'image':
      if (backgroundControls.value.image) {
        styles.backgroundImage = `url(${backgroundControls.value.image})`;
        styles.backgroundSize = 'cover';
        styles.backgroundPosition = 'center';
      }
      break;
    case 'gradient-image':
      if (backgroundControls.value.image) {
        styles.backgroundImage = `linear-gradient(${backgroundControls.value.gradient.direction}, ${backgroundControls.value.gradient.colors.join(', ')}), url(${backgroundControls.value.image})`;
        styles.backgroundSize = 'cover';
        styles.backgroundPosition = 'center';
      }
      break;
  }
  styles.opacity = backgroundControls.value.opacity[0] + '' || '1';

  return styles;
});

// Add method to handle file upload
const onBackgroundImageUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        backgroundControls.value.image = e.target.result as string;
        backgroundControls.value.type = 'image';
      }
    };
    reader.readAsDataURL(file);
  }
};

// Add this computed property for scaled dimensions
const scaledDimensions = computed(() => {
  const maxWidth = window.innerWidth * 0.7; // 70% of viewport width
  const maxHeight = window.innerHeight * 0.7; // 70% of viewport height

  const originalWidth = actualDimensions.value?.width || 0;
  const originalHeight = actualDimensions.value?.height || 0;

  let scale = 1;

  // Calculate scale if image is too large
  if (originalWidth > maxWidth || originalHeight > maxHeight) {
    const widthScale = maxWidth / originalWidth;
    const heightScale = maxHeight / originalHeight;
    scale = Math.min(widthScale, heightScale);
  }

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
    scale,
  };
});

// Add container size tracking
const editorContainer = ref<HTMLElement | null>(null);
const isOverflowing = ref(false);

// Add resize observer
onMounted(() => {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const container = entry.target as HTMLElement;
      isOverflowing.value = container.scrollHeight > window.innerHeight;
    }
  });

  if (editorContainer.value) {
    observer.observe(editorContainer.value);
  }

  return () => observer.disconnect();
});

const selectedFont = computed<string | null>(() => {
  if (!activeTextLayer.value) return null;
  const currentFontFamily = activeTextLayer.value.fontFamily;
  if (selectedFontCategory.value === 'google') {
    const font = fontFamilies['google'].find((f: FontItem) =>
      f.family.includes(currentFontFamily),
    );
    return font ? `font-${font.cssClass}` : null;
  } else {
    const font = fontFamilies['system'].find((f: FontItem) =>
      f.family.includes(currentFontFamily),
    );
    return font ? `font-${font.cssClass}` : null;
  }
});

// Add these utility functions at the top of the script
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB in bytes
const MAX_DIMENSION = 2048; // Maximum width or height

const resizeImage = (
  image: HTMLImageElement,
  maxDimension: number,
): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    let width = image.width;
    let height = image.height;

    // Calculate new dimensions while maintaining aspect ratio
    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas context');

    // Set transparent background
    ctx.clearRect(0, 0, width, height);

    // Draw image preserving transparency
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();

    const resizedImage = new Image();
    // Use PNG format to preserve transparency
    resizedImage.src = canvas.toDataURL('image/png');

    resizedImage.onload = () => {
      resolve(resizedImage);
    };
  });
};

const optimizeImage = async (imageFile: File): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        // Check if image needs optimization
        const needsResize =
          img.width > MAX_DIMENSION ||
          img.height > MAX_DIMENSION ||
          imageFile.size > MAX_IMAGE_SIZE;

        // if (needsResize) {
        //     const optimizedImage = await resizeImage(img, MAX_DIMENSION);
        //     resolve(optimizedImage);
        // } else {
        resolve(img);
        // }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(imageFile);
  });
};

// Add these refs to track optimized images
const optimizedBaseImage = ref<HTMLImageElement | null>(null);
const optimizedOverlayImage = ref<HTMLImageElement | null>(null);

// Add a watch for the base and overlay images
watch(
  () => props.baseImage,
  async (newImage) => {
    if (!newImage) {
      optimizedBaseImage.value = null;
      return;
    }

    try {
      if (newImage instanceof File) {
        optimizedBaseImage.value = await optimizeImage(newImage);
      } else {
        // If it's already an HTMLImageElement, check if it needs optimization
        const needsResize =
          newImage.width > MAX_DIMENSION || newImage.height > MAX_DIMENSION;

        if (needsResize) {
          optimizedBaseImage.value = await resizeImage(newImage, MAX_DIMENSION);
        } else {
          optimizedBaseImage.value = newImage;
        }
      }
    } catch (error) {
      console.error('Error optimizing base image:', error);
    }
  },
  { immediate: true },
);

watch(
  () => props.overlayImage,
  async (newImage) => {
    if (!newImage) {
      optimizedOverlayImage.value = null;
      return;
    }

    try {
      if (newImage instanceof File) {
        optimizedOverlayImage.value = await optimizeImage(newImage);
      } else {
        const needsResize =
          newImage.width > MAX_DIMENSION || newImage.height > MAX_DIMENSION;

        if (needsResize) {
          optimizedOverlayImage.value = await resizeImage(
            newImage,
            MAX_DIMENSION,
          );
        } else {
          optimizedOverlayImage.value = newImage;
        }
      }
    } catch (error) {
      console.error('Error optimizing overlay image:', error);
    }
  },
  { immediate: true },
);

const isMobile = useMediaQuery('(max-width: 768px)');
const showTextControlModal = ref(false);

const { stylesByCategory, addCustomStyle, customStyles } = useTextStyles();

// Add method to apply text style
const applyTextStyle = (style: TextStyle) => {
  if (textControls.value) {
    Object.assign(textControls.value, style.style);
  }
};

// Add method to save current style as custom
const saveCurrentAsCustomStyle = (name: string) => {
  if (textControls.value) {
    addCustomStyle({
      name,
      style: { ...textControls.value },
      category: 'custom',
    });
  }
};

const newStyleName = ref('');

useHead({
  //     < link rel = "preconnect" href = "https://fonts.googleapis.com" >
  // <link rel="preconnect" href = "https://fonts.gstatic.com" crossorigin >
  link: [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: 'anonymous',
    },
  ],
});
const { presets } = useImageFilterStyles();
const imageFilter = ref('none');
const activePreset = computed(() => {
  return presets.value.find((preset) => preset.name === imageFilter.value);
});

const editor = useTemplateRef('editor');
</script>

<template>
  <div ref="editor" class="flex gap-4 justify-items-center justify-center  max-h-[80vh]">
    <!-- Preview Area -->
    <div id="editor-container" ref="editorContainer" class="relative grid place-items-center overflow-hidden">
      <section class="bg-white border border-gray-200 relative transition-transform duration-200"
        :class="{ 'aspect-auto': aspectRatio === 'custom' || aspectRatio === 'image' }" :style="{
          width: `${scaledDimensions.width}px`,
          height: `${scaledDimensions.height}px`,
        }">
        <!--Add main background image or gradient  -->
        <section class="absolute inset-0" :style="backgroundStyle" />


        <!-- Base image -->
        <img v-if="optimizedBaseImage" :src="optimizedBaseImage.src"
          class="absolute inset-0 w-full h-full object-contain">

        <!-- Text Layers -->
        <TextBehindImageTextLayer v-for="layer in textLayers" :key="layer.id" :layer="layer"
          :editor-container="editorContainer" :is-active="activeTextLayerId === layer.id"
          :selected-font-class="selectedFont" @update:active-text-layer-id="activeTextLayerId = $event" />

        <!-- Overlay image -->
        <img v-if="optimizedOverlayImage" :src="optimizedOverlayImage.src"
          :style="{ 'filter': activePreset?.style || 'none' }"
          class="absolute inset-0 w-full h-full object-contain filter">
      </section>

    </div>
  </div>
  <!-- Editor Controls -->
  <TextBehindImageEditorControls :is-overflowing="isOverflowing" :text-layers="textLayers"
    :active-text-layer-id="activeTextLayerId" :aspect-ratios="aspectRatios" :aspect-ratio="aspectRatio"
    :custom-size="customSize" :optimized-base-image="optimizedBaseImage"
    :actual-dimensions="actualDimensions || { width: 0, height: 0 }" :text-controls="textControls" :is-mobile="isMobile"
    :styles-by-category="stylesByCategory" :new-style-name="newStyleName" :custom-styles="customStyles"
    :selected-font-category="selectedFontCategory" :font-families="fontFamilies" :positions="positions"
    :active-position="activePosition" :background-controls="backgroundControls" :background-style="backgroundStyle"
    :optimized-overlay-image="optimizedOverlayImage" :selected-font="selectedFont" @add-text-layer="addTextLayer"
    @delete-text-layer="deleteTextLayer" @update:active-text-layer-id="activeTextLayerId = $event"
    @update:aspect-ratio="aspectRatio = $event" @update:custom-size="customSize = $event"
    @update:text-controls="textControls = $event" @update:selected-font-category="selectedFontCategory = $event"
    @update:background-controls="backgroundControls = $event" @download-canvas="downloadCanvas" @reset="emit('reset')"
    @update:show-text-control-modal="showTextControlModal = $event" @apply-text-style="applyTextStyle"
    @save-current-as-custom-style="saveCurrentAsCustomStyle" @handle-predefined-position="HandlePredefinedPosition"
    @on-background-image-upload="onBackgroundImageUpload" @apply-filter-by-name="imageFilter = $event" />
  <!-- Add a size indicator -->
  <div class="absolute top-2 right-2 text-xs text-muted-foreground">
    Original: {{ actualDimensions?.width }}x{{ actualDimensions?.height }}
    <br>
    Displayed: {{ scaledDimensions.width }}x{{ scaledDimensions.height }}
  </div>
</template>

<style scoped>
.aspect-ratio-box {
  position: relative;
  height: 0;
  overflow: hidden;
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
