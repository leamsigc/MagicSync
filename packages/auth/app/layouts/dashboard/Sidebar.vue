<script lang="ts" setup>
const { navigationLinks, t } = useDashboardNavigation()

interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})
</script>

<template>
  <div class="px-1">
    <UNavigationMenu :items="navigationLinks" orientation="vertical" popover :collapsed="collapsed" color="neutral"
      class="data-[orientation=vertical]:space-y-1" variant="link" :ui="{
        link: 'dark:text-white/70 dark:hover:text-white hover:before:bg-white/5',
        linkLeadingIcon: 'dark:text-white/50 dark:group-hover:text-white/80',
        childLink: 'dark:text-white/60 dark:hover:text-white',
        childLinkIcon: 'dark:text-white/40',
      }" />
  </div>
</template>
<style scoped></style>
