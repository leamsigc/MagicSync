<script lang="ts" setup>
interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const { size = 'md' } = defineProps<Props>();
</script>

<template>
  <div class="min-h-screen">
    <div class="container mx-auto max-w-7xl flex gap-4 px-4 py-4">
      <!-- Left Sidebar (Navigation) - dark glass floating -->
      <header class="w-20 xl:w-72 shrink-0">
        <slot name="left-sidebar">
          <div class=" rounded-2xl  sticky top-4 border border-white/10">
            <BaseSidebarNavigation />
          </div>
        </slot>
      </header>

      <!-- Center (Main Content) -->
      <main class="flex-1 w-full" :class="{
        'max-w-7xl': size === 'lg',
        'max-w-2xl': size === 'md',
        'max-w-xl': size === 'sm'
      }">
        <div class=" rounded-2xl min-h-screen ">
          <div class="sticky top-0 z-10  rounded-t-2xl border-b border-border px-5 py-4">
            <h1 class="text-xl font-bold text-highlighted">Home</h1>
          </div>
          <div class="p-4">
            <slot />
          </div>
        </div>
      </main>

      <!-- Right Sidebar (Widgets) -->
      <slot name="right-sidebar">
        <div class="hidden xl:block  shrink-0">
          <div class=" rounded-2xl h-fit sticky top-4 ">
            <BaseSidebarRight />
          </div>
        </div>
      </slot>
    </div>
  </div>
</template>
