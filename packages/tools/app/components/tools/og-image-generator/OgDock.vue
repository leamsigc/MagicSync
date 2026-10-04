<script lang="ts" setup>
export type DockItem = {
  key: string
  icon: string
  label: string
}

const props = defineProps<{
  side: 'left' | 'right'
  items: DockItem[]
}>()

const active = defineModel<string | null>('active', { default: null })

const toggle = (key: string) => {
  active.value = active.value === key ? null : key
}
</script>

<template>
  <div class="fixed bottom-4 z-40 flex flex-col items-stretch gap-3" :class="side === 'left' ? 'left-4' : 'right-4'">
    <!-- Panel -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 translate-y-2"
    >
      <UCard
        v-if="active"
        class="w-[340px] max-w-[calc(100vw-2rem)] max-h-[62vh] overflow-y-auto shadow-2xl ring-1 ring-default backdrop-blur-md bg-elevated/90"
        :ui="{ body: 'p-4 space-y-4' }"
      >
        <slot :name="active" />
      </UCard>
    </Transition>

    <!-- Rail -->
    <div class="flex flex-row gap-1 self-center rounded-2xl border border-default bg-elevated/90 backdrop-blur-md p-1.5 shadow-2xl">
      <UTooltip v-for="item in props.items" :key="item.key" :text="item.label" placement="top">
        <UButton
          :icon="item.icon"
          :variant="active === item.key ? 'soft' : 'ghost'"
          color="primary"
          size="md"
          class="rounded-xl"
          :aria-label="item.label"
          @click="() => toggle(item.key)"
        />
      </UTooltip>
    </div>
  </div>
</template>
