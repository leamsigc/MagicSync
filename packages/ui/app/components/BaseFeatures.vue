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
    icon: string;
    title: string;
    description: string;
  }[];
}

const props = withDefaults(defineProps<Props>(), {
  list: () => [
    {
      icon: "i-lucide-tablet-smartphone",
      title: "Cross-Platform Compatibility",
      description: "Reach your audience wherever they are with seamless performance across web and mobile devices.",
    },
    {
      icon: "i-lucide-badge-check",
      title: "Enhanced Security",
      description: "Protect your data and user privacy with robust security measures and regular updates.",
    },
    {
      icon: "i-lucide-goal",
      title: "Scalable Architecture",
      description: "Grow your business without limits, thanks to a flexible and scalable system design.",
    },
    {
      icon: "i-lucide-picture-in-picture",
      title: "Intuitive User Interface",
      description: "Enjoy a smooth and engaging experience with a user-friendly design that simplifies complex tasks.",
    },
    {
      icon: "i-lucide-mouse-pointer-click",
      title: "Real-time Analytics",
      description: "Gain valuable insights into your performance with real-time data and customizable reports.",
    },
    {
      icon: "i-lucide-newspaper",
      title: "Integrated Content Management",
      description: "Effortlessly create, publish, and manage your content with our powerful built-in tools.",
    },
  ],
});

const { list } = toRefs(props);
</script>

<template>
  <section id="features" class="container mx-auto  py-24 sm:py-32" v-motion-fade-visible-once>
    <h2 class="text-lg text-primary text-center mb-2 tracking-wider">
      <slot name="title" mdc-unwrap="p"> Features </slot>
    </h2>

    <h3 class="text-3xl md:text-4xl text-center font-bold mb-4">
      <slot name="subtitle" mdc-unwrap="p">
        What Makes Us Different
      </slot>
    </h3>

    <h4 class="md:w-1/2 mx-auto text-xl text-center text-muted-foreground mb-8">
      <slot name="description" mdc-unwrap="p">
        Lorem ipsum dolor, sit amet consectetur adipisicing elit. Voluptatem fugiat, odit
        similique quasi sint reiciendis quidem iure veritatis optio facere tenetur.
      </slot>
    </h4>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="{ icon, title, description } in list" :key="title">
        <UCard class="h-full bg-background border-0 shadow-none">
          <template #header>
            <div class="flex justify-center items-center">
              <div class="bg-primary/20 p-2 rounded-full ring-8 ring-primary/10 mb-4">
                <Icon :name="icon" class="size-6 text-primary" />
              </div>

              <section>
                {{ title }}
              </section>
            </div>
          </template>

          <template #default>
            <section class="text-muted-foreground text-center">
              {{ description }}
            </section>
          </template>
        </UCard>
      </div>
    </div>
  </section>
</template>

<style lang="less" scoped></style>
