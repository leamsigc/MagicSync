<script lang="ts" setup>
/**
 * BaseAgentDirectory
 *
 * Grid of every AI connector MagicSync supports. Items come from
 * `useNavigationLinks().agents`, so labels, descriptions, icons and routes stay
 * in sync with the header "Use AI" menu and the footer.
 *
 * Used by the `/for` landing page. Copy lives in the page (`#title`,
 * `#description`); the card text is already localized under
 * `navigation.agentDesc.*`.
 */
interface Props {
  /** Desktop columns. */
  columns?: 2 | 3 | 4
}

const props = withDefaults(defineProps<Props>(), {
  columns: 3,
})

const { agents } = useNavigationLinks()

const GRID_CLASSES: Record<NonNullable<Props['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

const gridClass = computed(() => GRID_CLASSES[props.columns] ?? GRID_CLASSES[3])
</script>

<template>
  <section class="container mx-auto py-16 lg:py-24">
    <div class="mx-auto max-w-3xl text-center">
      <h2 class="text-3xl font-bold md:text-4xl">
        <slot name="title" />
      </h2>
      <p class="mt-3 text-lg text-muted-foreground">
        <slot name="description" />
      </p>
    </div>

    <ul class="mt-10 grid grid-cols-1 gap-4" :class="gridClass">
      <li v-for="agent in agents" :key="agent.to">
        <NuxtLinkLocale :to="agent.to"
          class="group flex h-full items-start gap-4 rounded-xl border border-default bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon :name="agent.icon" class="size-5" />
          </span>
          <span class="min-w-0">
            <span class="flex items-center gap-2 text-base font-semibold">
              {{ agent.label }}
              <Icon name="lucide:arrow-up-right"
                class="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </span>
            <span class="mt-1 block text-sm text-muted-foreground">{{ agent.description }}</span>
          </span>
        </NuxtLinkLocale>
      </li>
    </ul>
  </section>
</template>
