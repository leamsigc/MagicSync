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

interface ReviewProps {
  image: string;
  name: string;
  userName: string;
  comment: string;
  rating: number;
}
interface Props {
  list?: ReviewProps[];
}
const props = withDefaults(defineProps<Props>(), {
  list: () => [
    {
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b7e6?w=150&h=150&fit=crop&crop=face",
      name: "Jessica Martinez",
      userName: "Local Bakery Owner",
      comment:
        "This platform has revolutionized how I manage my bakery's online presence. The social media scheduling saves me hours every week!",
      rating: 5.0,
    },
    {
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      name: "Michael Rodriguez",
      userName: "Fitness Studio Owner",
      comment:
        "The Google My Business integration and analytics tools have helped my studio grow by 40% this year. Amazing results!",
      rating: 4.8,
    },
    {
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      name: "Sarah Chen",
      userName: "Photography Business Owner",
      comment:
        "I was struggling to stay organized across platforms, but this all-in-one solution makes everything so much easier. Highly recommend!",
      rating: 4.9,
    },
    {
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      name: "David Thompson",
      userName: "Retail Store Owner",
      comment:
        "The AI content generation is a game-changer for small businesses. Quality content without the stress!",
      rating: 5.0,
    },
    {
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
      name: "Emily Zhang",
      userName: "Coffee Shop Owner",
      comment:
        "Review management was always a headache, but this platform makes it effortless. My online reputation has improved dramatically.",
      rating: 5.0,
    },
    {
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
      name: "James Wilson",
      userName: "Consulting Firm Owner",
      comment:
        "Outstanding support and comprehensive analytics. This is exactly what small businesses need to compete online.",
      rating: 4.9,
    },
  ],
});
const { list } = toRefs(props);
</script>

<template>
  <section id="testimonials" class="container mx-auto py-24 sm:py-32" v-motion-fade-visible-once>
    <div class="text-center mb-8">
      <h2 class="text-lg text-primary text-center mb-2 tracking-wider">
        <slot name="title" mdc-unwrap="p"> Testimonials </slot>
      </h2>

      <h3 class="text-3xl md:text-4xl text-center font-bold mb-4">
        <slot name="subtitle" mdc-unwrap="p">
          Hear from Small Businesses We've Helped Succeed
        </slot>
      </h3>
    </div>

    <UCarousel v-slot="{ item: review }" :items="list" :opts="{
      align: 'start',
    }" :ui="{ item: 'basis-full md:basis-1/2 lg:basis-1/3' }"
      class="relative w-[80%] sm:w-[90%] lg:max-w-screen-xl mx-auto" arrows loop autoplay>
      <UCard class="bg-muted/50 dark:bg-card">
        <div class="px-6 py-6 pb-0">
          <div class="flex gap-1 pb-6">
            <UIcon name="lucide-star" class="size-4 fill-primary text-primary" />
            <UIcon name="lucide-star" class="size-4 fill-primary text-primary" />
            <UIcon name="lucide-star" class="size-4 fill-primary text-primary" />
            <UIcon name="lucide-star" class="size-4 fill-primary text-primary" />
            <UIcon name="lucide-star" class="size-4 fill-primary text-primary" />
          </div>

          "{{ review.comment }}"
        </div>

        <div class="flex flex-row items-center gap-4 px-6 py-4">
          <UAvatar size="lg" rounded>
            <img :src="review.image" :alt="review.name" class="rounded-full" />
          </UAvatar>

          <div class="flex flex-col">
            <p class="text-lg font-medium">{{ review.name }}</p>
            <p class="text-sm text-muted-foreground">{{ review.userName }}</p>
          </div>
        </div>
      </UCard>
    </UCarousel>
  </section>
</template>
