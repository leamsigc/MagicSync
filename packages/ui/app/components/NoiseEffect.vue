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
  noise?: number;
}

const { noise = 0.5 } = defineProps<Props>();
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice"
    class="absolute top-0 left-0" width="1200" height="675" :style="{
      opacity: noise,
      imageRendering: 'pixelated',
      transform: 'scale(1.5)'
    }">
    <filter id="noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" seed="1" />
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncR type="linear" slope="2" intercept="-0.5" />
        <feFuncG type="linear" slope="2" intercept="-0.5" />
        <feFuncB type="linear" slope="2" intercept="-0.5" />
      </feComponentTransfer>
      <feBlend mode="overlay" />
    </filter>
    <rect width="100%" height="100%" filter="url(#noise)" opacity="0.4" />
  </svg>
</template>

<style scoped></style>
