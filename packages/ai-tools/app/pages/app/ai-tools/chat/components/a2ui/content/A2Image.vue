<script setup lang="ts">
interface Props {
  definition: {
    id: string
    src?: string
    alt?: string
    variant?: 'avatar' | 'icon' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'cover'
    width?: number
    height?: number
  }
}

const props = defineProps<Props>()
</script>

<template>
  <div class="a2ui-image">
    <UAvatar
      v-if="definition.variant === 'avatar'"
      :src="definition.src"
      :alt="definition.alt"
      size="2xl"
    />
    <img
      v-else
      :src="definition.src"
      :alt="definition.alt"
      :width="definition.width"
      :height="definition.height"
      class="rounded-lg object-cover"
      loading="lazy"
    />
  </div>
</template>
