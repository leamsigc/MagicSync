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
const { footerLinks, features } = useNavigationLinks()
const { t } = useI18n()
</script>

<template>
  <aside class="hidden lg:block w-80 xl:w-96 pl-8 py-4 space-y-4">
    <!-- Search -->
    <div
      class="p-4 grid gap-4 border-b bg-gray-50 dark:bg-default rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800">
      <UButton label="Login" variant="solid" color="primary" class=" rounded-full w-full grid place-items-center "
        to="/login" />
      <UButton label="Register" variant="solid" color="primary" class=" rounded-full w-full grid place-items-center "
        to="/register" />
    </div>

    <!--Features of Magicsync -->
    <div class="bg-gray-50 dark:bg-default rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800">
      <h2 class="text-xl font-extrabold px-4 py-3 text-gray-900 dark:text-white">{{ t('footer.features') }}</h2>
      <div v-for="(feature, index) in features" :key="index"
        class="px-4 py-3 hover:bg-gray-100 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors border-b border-gray-100 dark:border-zinc-800 last:border-0">
        <div class="text-xs text-gray-500 flex justify-between">
          <span>{{ feature.stats }}</span>
          <UIcon name="i-heroicons-sparkles" class="text-primary" />
        </div>
        <div class="font-bold text-gray-900 dark:text-white">{{ feature.title }}</div>
        <div class="text-xs text-gray-500">{{ feature.subtitle }}</div>
      </div>
      <div class="px-4 py-3 text-primary hover:bg-gray-100 dark:hover:bg-zinc-800/50 cursor-pointer text-sm">
        {{ t('features.exploreAll') }}
      </div>
    </div>

    <!-- Footer Links -->
    <nav class="flex flex-wrap gap-x-4 gap-y-2 px-4 text-xs text-gray-500">
      <NuxtLink v-for="link in footerLinks.company.items" :key="link.label" :to="link.to" class="hover:underline">
        {{ link.label }}
      </NuxtLink>
      <NuxtLink v-for="link in footerLinks.legal" :key="link.label" :to="link.to" class="hover:underline">
        {{ link.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>
<style scoped></style>
