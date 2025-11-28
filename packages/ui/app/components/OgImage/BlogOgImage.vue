<script lang="ts" setup>
/**
 * @credits Pergel <https://nuxtlabs.com/>
 */
import { computed } from 'vue'

const { title = 'title', description = 'description', imageUrl = "https://raw.githubusercontent.com/leamsigc/MagicSync/refs/heads/main/images/HomePage.png", headline = 'headline' } = defineProps<{ title?: string, description?: string, headline?: string, imageUrl?: string }>();

const titleTrim = computed(() => title.slice(0, 60))
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center bg-[#212121]">
    <div class="absolute inset-0 bg-gray-950" :style="{ width: '1200px', height: '600px', }">
    </div>
    <NoiseEffect />
    <div class="w-[600px] pl-[100px]">
      <p v-if="headline" class="uppercase text-[24px] text-[#FEC476] mb-4 font-semibold">
        {{ headline }}
      </p>
      <h1 class="w-[600px] m-0 text-[75px] font-semibold mb-4 text-white"
        style="display: block; line-clamp: 2; text-overflow: ellipsis;">
        {{ titleTrim }}
      </h1>
      <p class="text-[32px] text-[#E4E4E7] leading-tight"
        style="display: block; line-clamp: 3; text-overflow: ellipsis;">
        {{ description }}
      </p>
    </div>
    <div class="w-[600px] absolute top-40 -right-2 -bottom-2 rounded-4xl ">
      <img :src="imageUrl" alt="Blog Image" height="500px" width="900px"
        :style="{ aspectRatio: '900/500', borderRadius: '10px', }" class="rounded-4xl mt-auto">
    </div>

  </div>
</template>
