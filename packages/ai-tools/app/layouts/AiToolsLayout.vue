<script lang="ts" setup>
const route = useRoute()

const navigation = [
  { name: 'Chat', href: '/app/ai-tools/chat', icon: 'i-lucide-message-square' },
  { name: 'Assets', href: '/app/ai-tools/chat/assets', icon: 'i-lucide-file-image' },
  { name: 'Knowledge', href: '/app/ai-tools/knowledge', icon: 'i-lucide-book-open' },
  { name: 'Skills', href: '/app/ai-tools/skills', icon: 'i-lucide-wrench' },
  { name: 'Tools', href: '/app/ai-tools/tools', icon: 'i-lucide-hammer' },
  { name: 'Growth', href: '/app/ai-tools/growth-stratergy', icon: 'i-lucide-rocket' },
  { name: 'Settings', href: '/app/ai-tools/settings', icon: 'i-lucide-settings' },
]

function isActive(href: string): boolean {
  return route.path === href || route.path.startsWith(href + '/')
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a] flex">
    <!-- Sidebar -->
    <aside class="w-56 border-r border-gray-700/50 bg-[#0d0d0d] flex flex-col">
      <div class="p-4 border-b border-gray-700/50">
        <NuxtLink to="/" class="flex items-center gap-2">
          <span class="text-lg font-bold text-white">MagicSync</span>
        </NuxtLink>
        <p class="text-xs text-gray-500 mt-1">AI Tools</p>
      </div>

      <nav class="flex-1 p-2 space-y-1">
        <NuxtLink v-for="item in navigation" :key="item.href" :to="item.href"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors" :class="{
            'bg-primary/10 text-primary': isActive(item.href),
            'text-gray-400 hover:text-white hover:bg-gray-800': !isActive(item.href)
          }">
          <UIcon :name="item.icon" class="w-4 h-4" />
          {{ item.name }}
        </NuxtLink>
      </nav>

      <div class="p-4 border-t border-gray-700/50">
        <UButton to="/app" icon="i-lucide-arrow-left" label="Dashboard" color="neutral" variant="ghost" size="sm"
          class="w-full justify-start text-gray-400" />
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </div>
  </div>
</template>
