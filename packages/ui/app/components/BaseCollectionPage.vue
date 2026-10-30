<script lang="ts" setup>
/**
 * Shared collection page shell.
 *
 * Every page that renders a collection (directory, admin table, gallery) uses
 * the same rhythm: page header → toolbar (search / filters / sort / view
 * switcher) → collection → footer. This component owns the container padding
 * and width so those pages stop disagreeing about `max-w-*`.
 */
interface Props {
  title: string
  description?: string
  /** Set to show a back button; omit for top-level pages. */
  backTo?: string
  container?: 'wide' | 'full' | 'narrow'
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  backTo: undefined,
  container: 'full',
})

const containerClass = computed(() => {
  if (props.container === 'full') return 'w-full p-4 lg:p-6'
  if (props.container === 'narrow') return 'mx-auto w-full max-w-4xl p-4 lg:p-6'
  return 'mx-auto w-full max-w-7xl p-4 lg:p-6'
})
</script>

<template>
  <div :class="containerClass">
    <BasePageHeader :title="title" :description="description" :back-to="backTo">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </BasePageHeader>

    <div v-if="$slots.toolbar" class="mt-4">
      <slot name="toolbar" />
    </div>

    <div class="mt-4">
      <slot />
    </div>

    <div v-if="$slots.footer" class="mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>
