import { ref, computed } from 'vue';

export type CanvasTool = 'select' | 'rectangle' | 'circle' | 'text' | 'line';

export interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
  selected: boolean;
  type: string;
}

export interface TextLayer {
  id: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color: string;
  textTransform?: string;
  textStroke?: string;
  backgroundGradient?: string;
  backgroundClip?: string;
  shadow: {
    enabled: boolean;
    color: string;
    multiShadow?: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  scale: number;
  positionX: number;
  positionY: number;
  zIndex: number;
}

export interface AspectRatios {
  [key: string]: {
    width: number;
    height: number;
    label: string;
  };
}

export interface BackgroundControls {
  type: 'none' | 'gradient' | 'image' | 'gradient-image';
  gradient: {
    direction: string;
    colors: string[];
  };
  image: string | null;
  opacity: number;
  predefinedBackgrounds: Array<{
    type: 'gradient' | 'gradient-image';
    name: string;
    gradient: {
      direction: string;
      colors: string[];
    };
    image?: string;
  }>;
}

export interface FontItem {
  cssClass: string;
  name: string;
  family: string;
}

export interface FontFamilies {
  system: Array<FontItem>;
  google: Array<FontItem>;
}


export type TextStyle = {
  name: string;
  style: {
    text?: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    textAlign: string;
    color: string;
    textTransform?: string;
    textStroke?: string;
    backgroundGradient?: string;
    backgroundClip?: string;
    shadow: {
      enabled: boolean;
      color: string;
      multiShadow?: string;
      blur: number;
      offsetX: number;
      offsetY: number;
    };
    scale: number;
  };
  category: 'headlines' | 'subtitles' | 'callouts' | 'quotes' | 'custom';
};

export type ImageFilterStyle = {
  name: string;
  style: string;
  category: 'preset' | 'custom';
};

export const useTextStyles = () => {
  const presets = ref<TextStyle[]>([
    {
      name: 'Bold Header',
      style: {
        fontSize: 72,
        fontFamily: 'Montserrat, sans-serif',
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
      },
      category: 'headlines',
    },
    {
      name: 'Elegant Title',
      style: {
        fontSize: 64,
        fontFamily: '"Playfair Display", serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#FFFFFF',
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.5)',
          blur: 8,
          offsetX: 0,
          offsetY: 4,
        },
        scale: 1,
      },
      category: 'headlines',
    },
    {
      name: 'Modern Subtitle',
      style: {
        fontSize: 36,
        fontFamily: 'Poppins, sans-serif',
        fontWeight: '500',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#E5E5E5',
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.3)',
          blur: 6,
          offsetX: 1,
          offsetY: 1,
        },
        scale: 1,
      },
      category: 'subtitles',
    },
    {
      name: 'Impact Quote',
      style: {
        fontSize: 48,
        fontFamily: 'Impact, fantasy',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#FFFFFF',
        shadow: {
          enabled: true,
          color: '#000000',
          blur: 0,
          offsetX: 2,
          offsetY: 2,
        },
        scale: 1,
      },
      category: 'quotes',
    },
    {
      name: 'Neon Effect',
      style: {
        fontSize: 56,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#00FF99',
        shadow: {
          enabled: true,
          color: '#FF00FF',
          blur: 15,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'callouts',
    },
    {
      name: 'Minimal Clean',
      style: {
        fontSize: 42,
        fontFamily: 'Helvetica, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#FFFFFF',
        shadow: {
          enabled: false,
          color: '#000000',
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'subtitles',
    },
    {
      name: 'Outlined Text',
      style: {
        fontSize: 64,
        fontFamily: 'Arial, sans-serif',
        fontWeight: '600',
        fontStyle: 'normal',
        textAlign: 'center',
        color: 'transparent',
        textTransform: 'uppercase',
        textStroke: '1px white',
        shadow: {
          enabled: true,
          color: 'white',
          blur: 0,
          offsetX: -4,
          offsetY: -4,
        },
        scale: 1,
      },
      category: 'headlines',
    },
    {
      name: 'Shadow Dance',
      style: {
        fontSize: 64,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#FFFFFF',
        shadow: {
          enabled: true,
          color: 'transparent',
          multiShadow: '5px 5px 0 #ff005e, 10px 10px 0 #00d4ff',
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'callouts',
    },
    {
      name: 'Neon Glow',
      style: {
        fontSize: 64,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#00FFFF',
        textTransform: 'uppercase',
        shadow: {
          enabled: true,
          color: 'transparent',
          multiShadow:
            '0 0 5px #0ff, 0 0 10px #0ff, 0 0 20px #00f, 0 0 30px #00f',
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'callouts',
    },
    {
      name: 'Melting Gradient',
      style: {
        fontSize: 96,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: 'transparent',
        textTransform: 'uppercase',
        backgroundGradient: 'linear-gradient(90deg, #ff6f61, #ffbd44, #ff6f61)',
        backgroundClip: 'text',
        scale: 1,
        shadow: {
          enabled: false,
          color: 'transparent',
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
      },
      category: 'headlines',
    },
    {
      name: 'Sign Painted',
      style: {
        fontSize: 96,
        fontFamily: 'Rancho, cursive',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#000000',
        shadow: {
          enabled: true,
          color: 'transparent',
          multiShadow: '0.02em 0.03em #fff, 0.05em 0.06em #1ba29a',
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'quotes',
    },
    {
      name: '3D Text',
      style: {
        fontSize: 64,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#FFFFFF',
        shadow: {
          enabled: true,
          color: 'transparent',
          multiShadow: `0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9,
                      0 5px 0 #aaa, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1),
                      0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2),
                      0 5px 10px rgba(0,0,0,.25), 0 10px 10px rgba(0,0,0,.2),
                      0 20px 20px rgba(0,0,0,.15)`,
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'headlines',
    },
    {
      name: 'Layered Shadow',
      style: {
        fontSize: 64,
        fontFamily: '"Meta", sans-serif',
        fontWeight: '900',
        fontStyle: 'normal',
        textAlign: 'center',
        color: 'transparent',
        textTransform: 'uppercase',
        textStroke: '4px #d6f4f4',
        shadow: {
          enabled: true,
          color: 'transparent',
          multiShadow: `10px 10px 0px #07bccc,
                        15px 15px 0px #e601c0,
                        20px 20px 0px #e9019a,
                        25px 25px 0px #f40468,
                        45px 45px 10px #482896`,
          blur: 0,
          offsetX: 0,
          offsetY: 0,
        },
        scale: 1,
      },
      category: 'headlines',
    },
  ]);

  const customStyles = ref<TextStyle[]>([]);

  const allStyles = computed(() => [...presets.value, ...customStyles.value]);

  const stylesByCategory = computed(() => {
    const categories = {
      headlines: [] as TextStyle[],
      subtitles: [] as TextStyle[],
      callouts: [] as TextStyle[],
      quotes: [] as TextStyle[],
      custom: [] as TextStyle[],
    };

    allStyles.value.forEach((style) => {
      categories[style.category].push(style);
    });

    return categories;
  });

  const addCustomStyle = (style: TextStyle) => {
    customStyles.value.push({
      ...style,
      category: 'custom',
    });
  };

  const removeCustomStyle = (styleName: string) => {
    const index = customStyles.value.findIndex((s) => s.name === styleName);
    if (index !== -1) {
      customStyles.value.splice(index, 1);
    }
  };

  return {
    presets,
    customStyles,
    allStyles,
    stylesByCategory,
    addCustomStyle,
    removeCustomStyle,
  };
};

export const useImageFilterStyles = () => {
  const presets = ref<ImageFilterStyle[]>([
    {
      name: 'None',
      style: 'none',
      category: 'preset',
    },
    {
      name: 'Grayscale',
      style: 'grayscale(100%)',
      category: 'preset',
    },
    {
      name: 'Sepia',
      style: 'sepia(100%)',
      category: 'preset',
    },
    {
      name: 'Blur',
      style: 'blur(5px)',
      category: 'preset',
    },
    {
      name: 'Brightness',
      style: 'brightness(150%)',
      category: 'preset',
    },
    {
      name: 'Contrast',
      style: 'contrast(200%)',
      category: 'preset',
    },
    {
      name: 'Invert',
      style: 'invert(100%)',
      category: 'preset',
    },
    {
      name: 'Saturate',
      style: 'saturate(200%)',
      category: 'preset',
    },
    {
      name: 'Hue Rotate',
      style: 'hue-rotate(90deg)',
      category: 'preset',
    },
    {
      name: 'Opacity',
      style: 'opacity(50%)',
      category: 'preset',
    },
    {
      name: 'Vintage',
      style: 'sepia(30%) saturate(150%) contrast(120%) brightness(90%)',
      category: 'preset',
    },
    {
      name: 'Lomo',
      style: 'contrast(150%) brightness(110%)',
      category: 'preset',
    },
    {
      name: 'Duotone',
      style: 'sepia(50%) hue-rotate(200deg) saturate(200%)',
      category: 'preset',
    },
    {
      name: 'Technicolor',
      style: 'contrast(120%) saturate(150%) hue-rotate(180deg)',
      category: 'preset',
    },
    {
      name: 'Polaroid',
      style: 'contrast(120%) brightness(110%) sepia(20%)',
      category: 'preset',
    },
    {
      name: 'Sharpen',
      style: 'contrast(120%) brightness(100%)',
      category: 'preset',
    },
    {
      name: 'Warm',
      style: 'sepia(20%) brightness(110%) contrast(90%)',
      category: 'preset',
    },
    {
      name: 'Cool',
      style: 'brightness(110%) contrast(90%) hue-rotate(200deg)',
      category: 'preset',
    },
    {
      name: 'Darken',
      style: 'brightness(70%)',
      category: 'preset',
    },
    {
      name: 'Lighten',
      style: 'brightness(130%)',
      category: 'preset',
    },
  ]);

  const customStyles = ref<ImageFilterStyle[]>([]);

  const allStyles = computed(() => [...presets.value, ...customStyles.value]);

  const addCustomStyle = (style: ImageFilterStyle) => {
    customStyles.value.push({
      ...style,
      category: 'custom',
    });
  };

  const removeCustomStyle = (styleName: string) => {
    const index = customStyles.value.findIndex((s) => s.name === styleName);
    if (index !== -1) {
      customStyles.value.splice(index, 1);
    }
  };

  return {
    presets,
    customStyles,
    allStyles,
    addCustomStyle,
    removeCustomStyle,
  };
};
