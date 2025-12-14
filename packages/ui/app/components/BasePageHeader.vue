<script lang="ts" setup>
/**
 * Component Description: Asset Page Header with Navigation and Actions
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

interface Props {
  title: string
  description: string
}

const props = defineProps<Props>()


</script>

<template>
  <div class="flex items-center justify-between">
    <div class=" md:mb-4">
      <div class="flex items-center gap-2">
        <UButton variant="ghost" size="sm" as-child>
          <NuxtLink to="/app">
            <Icon name="lucide:arrow-left" size="32" />
          </NuxtLink>
        </UButton>
        <div class="">
          <h1 class="  md:text-3xl font-bold">
            <slot name="title">
              {{ title }}
            </slot>
          </h1>
          <p class="text-muted-foreground hidden md:block">
            <slot name="description">
              {{ description }}
            </slot>
          </p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
