<script lang="ts" setup>
const { theme, setTheme, currentTheme, themes } = useTheme()
</script>

<template>
  <UPopover mode="click" :ui="{ content: 'min-w-40' }">
    <UButton
      color="neutral"
      variant="ghost"
      :icon="currentTheme.icon"
      :aria-label="`Theme: ${currentTheme.label}`"
    />
    <template #content>
      <div class="p-1 space-y-0.5">
        <UButton
          v-for="t in themes"
          :key="t.id"
          color="neutral"
          variant="ghost"
          class="w-full justify-start gap-2"
          :class="{ 'bg-elevated': theme === t.id }"
          @click="setTheme(t.id)"
        >
          <template #leading>
            <span
              class="size-3 rounded-full shrink-0"
              :style="{ backgroundColor: t.color }"
            />
          </template>
          <span class="text-sm">{{ t.label }}</span>
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
