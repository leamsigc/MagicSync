<i18n src="./Menu.json"></i18n>

<script lang="ts" setup>

/**
 *
 * Component Description: User navigation dropdown for the dashboard header.
 * Menu items come from useDashboardNavigation().userMenuItems so the header
 * dropdown and the Twitter-style sidebar share one source of truth.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.2.0
 */

interface Props {
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})

const { user } = UseUser();
const { userMenuItems } = useDashboardNavigation();

</script>

<template>
  <UDropdownMenu :items="userMenuItems" :ui="{ content: 'bg-elevated rounded-xl ' }">
    <UButton color="neutral" variant="ghost" class="w-full justify-start">
      <div v-if="props.collapsed">
        <UAvatar :src="user?.image || ''" :alt="user?.name" />
      </div>
      <div v-else class="flex items-center gap-3 p-3">
        <UAvatar :src="user?.image || ''" :alt="user?.name" size="2xl" />
        <div class="text-left min-w-0 flex-1">
          <p class="truncate font-medium text-sm">
            {{ user?.name || 'User' }}
          </p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ user?.email || 'email@domain.com' }}
          </p>
        </div>
      </div>
    </UButton>

    <template #account="{ item }">
      <div class="flex items-center gap-3 p-3">
        <UAvatar :src="item.avatar?.src" :alt="item.avatar?.alt" size="2xl" />
        <div class="text-left min-w-0 flex-1">
          <p class="truncate font-medium text-sm">
            {{ item.name }}
          </p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ item.email }}
          </p>
        </div>
      </div>
    </template>



    <template #item="{ item }">
      <div class="flex items-center gap-2">
        <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 text-gray-500" />
        <span class="truncate">{{ item.label }}</span>
        <UBadge v-if="'badge' in item" :label="item.badge" variant="subtle" size="xs" class="ml-auto" />
      </div>
    </template>

    <template #item-leading="{ item }">
      <UIcon v-if="'icon' in item" :name="item.icon" class="shrink-0 h-4 w-4 text-gray-500" />
    </template>
  </UDropdownMenu>
</template>

<style scoped></style>
