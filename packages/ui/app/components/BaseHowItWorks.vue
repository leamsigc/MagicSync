<script setup lang="ts">
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
interface Props {
  list?: {
    badgeTitle: string;
    title: string;
    description: string;
    image: string;
  }[];
  type: 'default' | 'vertical' | 'horizontal';
}

const props = withDefaults(defineProps<Props>(), {
  list: () => [
    {
      badgeTitle: "Step 1",
      title: "Connect Your Accounts",
      description: "Easily link your social media profiles and Google My Business to our platform in minutes.",
      image: "https://shadcn-vue-landing-page.vercel.app/roboto.png",
    },
    {
      badgeTitle: "Step 2",
      title: "Plan Your Content",
      description: "Use our intuitive calendar and AI tools to schedule posts, generate ideas, and create engaging content.",
      image: "https://shadcn-vue-landing-page.vercel.app/runner.png",
    },
    {
      badgeTitle: "Step 3",
      title: "Engage and Grow",
      description: "Monitor your performance, respond to comments, and interact with your audience all from one dashboard.",
      image: "https://shadcn-vue-landing-page.vercel.app/pacheco.png",
    },
    {
      badgeTitle: "Step 4",
      title: "Analyze and Optimize",
      description: "Gain insights with detailed analytics and optimize your strategy for maximum reach and impact.",
      image: "https://shadcn-vue-landing-page.vercel.app/gamestation.png",
    },
  ],
  type: 'default'
});
const { list } = toRefs(props);
</script>

<template>
  <section id="how-it-works" class="container mx-auto py-24 sm:py-32" v-motion-fade-visible-once>
    <div class="text-center mb-8">
      <h2 class="text-lg text-primary text-center mb-2 tracking-wider">
        <slot name="title" mdc-unwrap="p"> How It Works </slot>
      </h2>

      <h3 class="text-3xl md:text-4xl text-center font-bold">
        <slot name="subtitle" mdc-unwrap="p">
          Step-by-Step Process
        </slot>
      </h3>
    </div>

    <div class=" mx-auto relative">
      <div v-for="({ badgeTitle, title, description, image }, index) in list" :key="title"
        :class="['flex mb-8 items-center gap-2', { ' flex-row-reverse': index % 2 !== 0 }]">
        <UCard class="h-full bg-transparent border-0 shadow-none">
          <template #header>
            <div class="pb-4">
              <UBadge>{{ badgeTitle }}</UBadge>
            </div>

            <h3 class="text-xl font-bold">
              {{ title }}
            </h3>
          </template>

          <template #default>
            <p class="text-muted-foreground w-[80%]">
              {{ description }}
            </p>
          </template>
        </UCard>

        <NuxtImg :src="image" :alt="`Image describing ${title} `" class=" mx-auto -scale-x-100"
          :class="{ 'w-[150px] md:w-[250px] lg:w-[300px]': type === 'default', 'w-1/2 aspect-video': type === 'vertical', 'w-[400px]': type === 'horizontal' }" />
        <div :class="[
          '-z-10 absolute right-0 w-44 h-72  lg:w-64 lg:h-80 rounded-full bg-primary/15 dark:bg-primary/10 blur-3xl',
          {
            'left-0': index % 2 !== 0,
          },
        ]" />
      </div>
    </div>
  </section>
</template>
