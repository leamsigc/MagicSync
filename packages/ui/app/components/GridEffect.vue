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

interface Props {
  grid?: {
    pattern?: string;
    color?: string;
    opacity?: number;
  };
  blurStart?: number;
  blurEnd?: number;
}
const { grid = {
  pattern: 'grid',
  color: 'white',
  opacity: 0.5,
  blur: 4,
}, blurStart = 0, blurEnd = 0 } = defineProps<Props>();
const generateGridPattern = ({
  grid,
}: {
  grid?: { pattern?: string; color?: string; opacity?: number };
}) => {
  if (!grid || !grid.pattern || grid.pattern === 'none') return '';

  const size = 30;
  const sizeCircle = 12;
  const sizeGraph = 60;
  const { pattern = 'grid', color = '#ffffff', opacity = 1 } = grid;

  const svgTemplates: Record<string, string> = {
    grid: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grid)" />
    </svg>`,
    dots: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="2" fill="${color}" fill-opacity="${opacity}" />
    </svg>`,
    graph: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <g fill-rule="evenodd" fill="${color}" fill-opacity="${opacity}">
        <g>
          <path opacity="0.5" d="M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z"/>
          <path d="M6 5V0H5v5H0v1h5v94h1V6h94V5H6z" />
        </g>
      </g>
    </svg>`,
  };

  const svg = svgTemplates[pattern];
  if (!svg) return 'none';

  console.log(svg);


  const encoded = encodeURIComponent(svg)
  return `url("data:image/svg+xml;utf8,${encoded}")`
}
</script>

<template>
  <div class="absolute inset-0 " :style="{
    backgroundImage: generateGridPattern({ grid: grid }),
    backgroundRepeat: 'repeat',
    backgroundSize: '1200px 1200px',
    mask: `radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${blurStart}%, rgba(0,0,0,0) ${blurEnd}%)`,
    WebkitMask: `radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${blurStart}%, rgba(0,0,0,0) ${blurEnd}%)`
  }"></div>
</template>

<style scoped></style>
