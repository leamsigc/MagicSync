<script lang="ts" setup>
/**
 *
 * BaseCallToAction component
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

interface Props {
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  }
  secondaryAction?: {
    label: string;
    href: string;
  }
}

const props = defineProps<Props>();
</script>

<template>
  <section id="call-to-action" class="mx-auto py-12" v-motion-fade-visible-once :delay="200" :duration="1200">
    <div class="container  mx-auto">
      <BaseShinyCard class="lg:w-[60%] mx-auto" :show-bg="false">
        <UCard
          class="bg-muted/50 dark:bg-card hover:bg-background dark:hover:bg-background transition-all delay-75 group/number h-full text-center p-4"
          :ui="{ body: 'border-0' }">
          <template #header>
            <h2 class="text-4xl md:text-5xl font-bold">
              <slot name="title" mdc-unwrap="p">
                {{ title }}
              </slot>
            </h2>
          </template>
          <div class="lg:w-[80%] mx-auto text-xl text-muted-foreground">
            <slot name="description" mdc-unwrap="p">
              {{ description }}
            </slot>
          </div>

          <template #footer>
            <div class="flex gap-4 justify-center">
              <UButton :to="primaryAction.href" :aria-label="primaryAction.label" variant="outline"
                :title="primaryAction.label">
                {{ primaryAction.label }}
              </UButton>
              <UButton v-if="secondaryAction" :to="secondaryAction.href" :aria-label="secondaryAction.label"
                variant="ghost" :title="secondaryAction.label">
                {{ secondaryAction.label }}
              </UButton>
            </div>
          </template>
        </UCard>
      </BaseShinyCard>
    </div>
  </section>
</template>
<style scoped></style>
