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
            <div class="lg:w-[60%] mx-auto">
                <UCard class="bg-background shadow-none text-center flex flex-col items-center justify-center border-0">
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
                        <div class="flex gap-4">
                            <UButton :to="primaryAction.href" :aria-label="primaryAction.label" variant="outline"
                                :title="primaryAction.label">
                                {{ primaryAction.label }}
                            </UButton>
                            <UButton v-if="secondaryAction" :to="secondaryAction.href"
                                :aria-label="secondaryAction.label" variant="ghost" :title="secondaryAction.label">
                                {{ secondaryAction.label }}
                            </UButton>
                        </div>
                    </template>
                </UCard>
            </div>
        </div>
    </section>
</template>
<style scoped></style>