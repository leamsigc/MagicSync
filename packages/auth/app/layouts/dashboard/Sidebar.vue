<script lang="ts" setup>
/**
 *
 * Component Description: Dashboard sidebar with navigation menu using Nuxt UI components
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import type { NavigationMenuItem } from '@nuxt/ui'

const { navigationLinks, t } = useDashboardNavigation()

interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})
</script>

<template>
  <div>
    <!-- Main Navigation Menu -->
    <UNavigationMenu :items="navigationLinks" orientation="vertical" popover :collapsed="collapsed" color="primary"
      class="data-[orientation=vertical]:space-y-4" type="single" variant="link" />
  </div>
</template>
<style scoped></style>
