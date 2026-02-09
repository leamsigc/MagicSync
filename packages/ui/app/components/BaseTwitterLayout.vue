<script lang="ts" setup>
/**
 * Component Description: Main Layout for the Twitter-like interface
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const { size = 'md' } = defineProps<Props>();


</script>

<template>
  <div class="min-h-screen bg-white dark:bg-default text-black dark:text-gray-100">
    <div class="container mx-auto max-w-7xl flex">
      <!-- Left Sidebar (Navigation) -->
      <header class="w-20 xl:w-72 shrink-0 border-r border-gray-200 dark:border-zinc-800">
        <slot name="left-sidebar">
          <BaseSidebarNavigation />
        </slot>
      </header>

      <!-- Center (Main Content) -->
      <main class="flex-1 w-full max-w-2xl border-r border-gray-200 dark:border-zinc-800 min-h-screen" :class="{
        'max-w-7xl': size === 'lg',
        'max-w-2xl': size === 'md',
        'max-w-xl': size === 'sm'
      }">
        <!-- Sticky Header -->
        <div
          class="sticky top-0 z-10 bg-white/80 dark:bg-default/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-3 cursor-pointer">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Home</h1>
        </div>
        <slot />
      </main>

      <!-- Right Sidebar (Widgets) -->
      <slot name="right-sidebar">
        <BaseSidebarRight />
      </slot>

    </div>
  </div>
</template>
