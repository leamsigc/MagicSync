<i18n src="#site/app/pages/app/business/business.json"></i18n>
<script lang="ts" setup>
/**
 * The business workspace tab bar. A business has one hub
 * (`/app/business/[id]/content`) whose tabs are separate routes, so each tab
 * deep-links and the browser back button works. Every tab page renders this
 * bar; the board's item drill-in does not.
 */
export type WorkspaceTab = 'edit' | 'playbook' | 'content' | 'corpus' | 'publishing'

const props = defineProps<{
  businessId: string
  active: WorkspaceTab
}>()

const { t } = useI18n()

interface TabLink {
  key: WorkspaceTab
  to: string
  icon: string
}

const tabs = computed<TabLink[]>(() => [
  { key: 'edit', to: `/app/business/${props.businessId}/content/edit`, icon: 'lucide:building-2' },
  { key: 'playbook', to: `/app/business/${props.businessId}/content/playbook`, icon: 'lucide:book-open' },
  { key: 'content', to: `/app/business/${props.businessId}/content`, icon: 'lucide:kanban' },
  { key: 'corpus', to: `/app/business/${props.businessId}/content/corpus`, icon: 'lucide:database' },
  { key: 'publishing', to: `/app/business/${props.businessId}/content/publishing`, icon: 'lucide:send' },
])
</script>

<template>
  <nav
    class="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-default bg-elevated p-1"
    data-testid="business-workspace-tabs"
    :aria-label="t('title')"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      :class="active === tab.key
        ? 'bg-default text-highlighted shadow-sm'
        : 'text-muted hover:bg-default/60 hover:text-highlighted'"
      :aria-current="active === tab.key ? 'page' : undefined"
    >
      <UIcon :name="tab.icon" class="size-4 shrink-0" />
      {{ t(`workspace_tabs.${tab.key}`) }}
    </NuxtLink>
  </nav>
</template>
