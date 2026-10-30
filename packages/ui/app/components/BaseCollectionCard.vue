<i18n src="./BaseCollection.json"></i18n>
<script lang="ts" setup>
/**
 * The shared collection card (grid tile). Mirrors the `/app/business` tile:
 * avatar/icon, title + badge, two-line description, meta row, optional
 * progress and a per-card menu.
 *
 * Grid pages that need something bespoke can still use `BaseCollectionGrid`'s
 * `#item` slot directly; this covers the common directory tile.
 */
interface Props {
  title: string
  description?: string
  icon?: string
  avatarText?: string
  avatarClass?: string
  badge?: string
  badgeColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  to?: string
  active?: boolean
  menu?: Array<Array<Record<string, any>>>
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  icon: '',
  avatarText: '',
  avatarClass: 'bg-primary',
  badge: '',
  badgeColor: 'neutral',
  to: '',
  active: false,
  menu: () => [],
})
</script>

<template>
  <UCard class="flex h-full flex-col" :ui="{ body: 'sm:p-4', root: 'sm:p-0' }">
    <div class="flex items-start gap-3">
      <span v-if="props.avatarText" class="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" :class="props.avatarClass">
        {{ props.avatarText }}
      </span>
      <span v-else-if="props.icon" class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated">
        <UIcon :name="props.icon" class="size-5" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <NuxtLink v-if="props.to" :to="props.to" class="truncate font-semibold text-highlighted hover:underline">
            {{ props.title }}
          </NuxtLink>
          <h3 v-else class="truncate font-semibold text-highlighted">{{ props.title }}</h3>
          <slot name="title-actions" />
          <UBadge v-if="props.badge" class="ms-auto shrink-0" :color="props.badgeColor" variant="subtle" size="sm">
            {{ props.badge }}
          </UBadge>
        </div>
        <p v-if="props.description" class="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{{ props.description }}</p>

        <slot />

        <div v-if="$slots.meta" class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap text-muted">
          <slot name="meta" />
        </div>
      </div>

      <UDropdownMenu v-if="props.menu.length > 0" :items="props.menu" :content="{ align: 'end' }">
        <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="$t('actions')" />
      </UDropdownMenu>
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UCard>
</template>
