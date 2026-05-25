<script lang="ts" setup>

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

interface MenuItem {
  icon?: string;
  translationKey?: string;
  action?: () => void;
  slotName?: string; // New property to define a dynamic slot
}

const props = defineProps<{
  menu: MenuItem[];
}>();

const { t } = useI18n();
const isOpen = ref(false); // Keep isOpen for potential internal use or if a menu item still needs it
</script>

<template>
  <!-- Top Menu  -->
  <header class="fixed top-10 left-6 z-40 backdrop-blur-md bg-background/20  rounded-2xl shadow-2xl">
    <section class="flex items-center px-4 py-3 gap-4">
      <section class="flex items-center gap-2 ">
        <NuxtLink to="/">
          <UButton variant="link">Magic Social</UButton>
        </NuxtLink>
        <template v-for="(item, index) in props.menu" :key="`${item.icon}-${index}`">
          <template v-if="item.slotName">
            <slot :name="item.slotName" :item="item" />
          </template>
          <UButton v-else size="sm" color="neutral" variant="link" @click="item.action">
            <Icon v-if="item.icon" :name="item.icon" class="w-5 h-5" />
            <span v-if="item.translationKey">{{ item.translationKey }}</span>
          </UButton>
        </template>
      </section>
    </section>
  </header>
</template>
<style scoped></style>
