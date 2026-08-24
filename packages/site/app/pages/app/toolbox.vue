<i18n src="./toolbox.json"></i18n>
<script lang="ts" setup>
import { TOOL_CATEGORIES, toolRegistry, type ToolCategory, type ToolDefinition } from '#layers/BaseUI/app/utils/toolRegistry'

const { t } = useI18n()

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') }
  ]
})

function badgeLabel(tool: ToolDefinition): string {
  return t(`badges.${tool.badge ?? tool.audience}`)
}

const groupedTools = computed(() => {
  return TOOL_CATEGORIES
    .map((category: ToolCategory) => ({
      category,
      tools: toolRegistry.filter(tool => tool.category === category)
    }))
    .filter(group => group.tools.length > 0)
})
</script>

<template>
  <div class="max-w-6xl mx-auto p-6">
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        {{ t('title') }}
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        {{ t('description') }}
      </p>
    </header>

    <section
      v-for="group in groupedTools"
      :key="group.category"
      class="mb-10"
    >
      <h2 class="text-lg font-semibold tracking-tight text-foreground mb-4">
        {{ t(`categories.${group.category}`) }}
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="tool in group.tools"
          :key="tool.id"
          :to="tool.route"
          class="group rounded-xl border border-border bg-card text-card-foreground p-5 transition-colors hover:border-primary focus-visible:outline-primary"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              <UIcon :name="tool.icon" class="w-5 h-5 text-primary" />
            </div>
            <UBadge
              :color="tool.audience === 'app' ? 'primary' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ badgeLabel(tool) }}
            </UBadge>
          </div>
          <h3 class="mt-4 font-medium text-foreground">
            {{ tool.name }}
          </h3>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ tool.description }}
          </p>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped></style>
