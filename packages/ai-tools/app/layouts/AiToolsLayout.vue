<script lang="ts" setup>
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] flex flex-col">
    <!-- Minimal top bar -->
    <header class="flex items-center justify-between px-6 py-3 border-b border-gray-700/50 bg-[#0d0d0d]">
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="text-lg font-bold text-white">MagicSync</span>
      </NuxtLink>
      <div class="flex items-center gap-3">
        <UButton to="/app/posts/feeds" icon="i-heroicons-squares-2x2" color="neutral" variant="ghost" size="sm"
          class="text-gray-400 hover:text-white" />
      </div>
    </header>

    <!-- Full viewport content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </div>
  </div>
</template>
