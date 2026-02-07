<script lang="ts" setup>
/**
 * Component Description: Mock Editor Orchestrator for Twitter-like interface
 * Replicates the UI of PostModalContent.vue using local UI elements only.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.1.0
 */

const { t } = useI18n();

// Mock Data
const connectedSocialAccountsList = [
  { id: '1', platform: 'facebook', accountName: 'Facebook Page', picture: 'https://avatars.githubusercontent.com/u/23272293?s=96&v=4' },
  { id: '2', platform: 'instagram', accountName: 'Instagram Biz', picture: 'https://avatars.githubusercontent.com/u/23272293?s=96&v=4' },
  { id: '3', platform: 'twitter', accountName: 'Twitter X', picture: 'https://avatars.githubusercontent.com/u/23272293?s=96&v=4' },
];

const selectedSocialMediaAccounts = ref(['3']);
const explicitPreviewPlatform = ref('default');
const postForm = ref({
  content: '',
  comment: [],
  postFormat: 'post'
});

const postMediaAssets = ref([]);

const tabs = [
  { label: 'Editor', icon: 'i-heroicons-pencil-square', slot: 'editor' },
  { label: 'Media', icon: 'i-heroicons-photo', slot: 'media' }
];

const contextTabs = computed(() => {
  const base = [{ label: 'Master', value: 'default', icon: 'i-heroicons-globe-alt' }];
  const selected = connectedSocialAccountsList
    .filter(a => selectedSocialMediaAccounts.value.includes(a.id))
    .map(p => ({
      label: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      value: p.platform,
      icon: `i-simple-icons-${p.platform}`
    }));
  return [...base, ...selected];
});

const activeContextLabel = computed(() => {
  if (explicitPreviewPlatform.value === 'default') return 'Master';
  return explicitPreviewPlatform.value.charAt(0).toUpperCase() + explicitPreviewPlatform.value.slice(1);
});

// Mock Actions
const togglePlatform = (id: string) => {
  const index = selectedSocialMediaAccounts.value.indexOf(id);
  if (index === -1) {
    selectedSocialMediaAccounts.value.push(id);
  } else {
    selectedSocialMediaAccounts.value.splice(index, 1);
  }
};

const revertToMaster = () => { explicitPreviewPlatform.value = 'default'; };
const handleAIAction = () => console.log('AI Action triggered');

</script>

<template>
  <div class=" rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-2xl">
    <!-- Top Platform Selector -->
    <div class="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-default/30">
      <div class="flex gap-3 overflow-x-auto pb-2 overflow-y-visible py-2">
        <div v-for="account in connectedSocialAccountsList" :key="account.id" @click="togglePlatform(account.id)"
          class="relative cursor-pointer transition-all duration-200 shrink-0 group">
          <UChip :show="selectedSocialMediaAccounts.includes(account.id)" color="primary" size="2xl"
            position="top-right">
            <UAvatar :src="account.picture" :alt="account.accountName" size="lg" class="border-2 transition-all"
              :class="selectedSocialMediaAccounts.includes(account.id) ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent opacity-50 grayscale hover:grayscale-0 hover:opacity-100'" />
          </UChip>
          <div
            class="absolute -bottom-1 -right-1 bg-white dark:bg-default rounded-full p-1 shadow-sm border border-gray-100 dark:border-zinc-800 grid place-items-center">
            <UIcon :name="`i-simple-icons-${account.platform}`" class="size-3 text-gray-500" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-zinc-800">
      <!-- Left Side: Editor -->
      <div class="flex-1 min-w-0 flex flex-col">
        <UTabs :items="tabs" variant="link" class="w-full" :ui="{ trigger: 'grow' }">
          <template #editor>
            <div class="p-4 space-y-5">
              <!-- Context Switcher -->
              <div
                class="flex items-center justify-between bg-gray-100/50 dark:bg-default/50 p-1 rounded-lg border border-gray-200 dark:border-zinc-800">
                <div class="flex gap-1">
                  <UButton v-for="tab in contextTabs" :key="tab.value" @click="explicitPreviewPlatform = tab.value"
                    variant="ghost" size="xs" color="neutral"
                    :class="explicitPreviewPlatform === tab.value ? 'bg-white dark:bg-zinc-800 shadow-sm text-primary' : 'text-gray-500'">
                    <UIcon :name="tab.icon" class="mr-1" />
                    {{ tab.label }}
                  </UButton>
                </div>
                <UButton v-if="explicitPreviewPlatform !== 'default'" @click="revertToMaster" variant="link"
                  color="neutral" size="xs" class="text-xs hover:text-red-500">
                  <UIcon name="i-heroicons-arrow-path" class="mr-1" />
                  Revert
                </UButton>
              </div>

              <!-- Content Editor Area -->
              <div
                class="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <div v-if="explicitPreviewPlatform !== 'default'"
                  class="px-4 py-1.5 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
                  <UIcon name="i-heroicons-information-circle" class="text-primary w-4 h-4" />
                  <span class="text-[10px] font-medium text-primary uppercase tracking-wider">Editing {{
                    activeContextLabel }} Override</span>
                </div>

                <UTextarea v-model="postForm.content"
                  :placeholder="`What would you like to post on ${activeContextLabel}?`" :rows="10" variant="none"
                  class="w-full p-4 text-lg bg-transparent border-none focus:ring-0 placeholder-gray-400 dark:placeholder-zinc-600" />

                <div
                  class="px-4 py-3 border-t border-gray-100 dark:border-zinc-800/50 flex items-center justify-between bg-gray-50/30 dark:bg-default/20">
                  <div class="flex items-center gap-3">
                    <UButton icon="i-heroicons-sparkles" variant="ghost" color="primary" size="xs" label="AI Assistant"
                      @click="handleAIAction" />
                    <UButton icon="i-heroicons-face-smile" variant="ghost" color="neutral" size="xs" />
                    <UButton icon="i-heroicons-variable" variant="ghost" color="neutral" size="xs" />
                  </div>
                  <div class="text-xs font-mono"
                    :class="postForm.content.length > 280 ? 'text-red-500 font-bold' : 'text-gray-400'">
                    {{ postForm.content.length }} / 280
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #media>
            <div class="p-12 text-center">
              <div class="inline-flex p-4 rounded-full bg-gray-100 dark:bg-default mb-4">
                <UIcon name="i-heroicons-photo" class="w-8 h-8 text-gray-400" />
              </div>
              <h3 class="text-lg font-bold mb-1">Media Gallery Mock</h3>
              <p class="text-gray-500 text-sm max-w-xs mx-auto">Select images or videos from your library to attach to
                your post.</p>
              <UButton label="Upload Assets" color="primary" variant="solid" class="mt-6 rounded-full" to="/login" />
            </div>
          </template>
        </UTabs>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="p-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3 bg-gray-50 dark:bg-default/50">
      <UButton label="Discard" variant="ghost" color="neutral" />
      <div class="flex-1" to="/login" />
      <UButton label="Save Draft" variant="outline" color="neutral" to="/login" />
      <UButton label="Schedule Post" color="primary" class="rounded-full px-8 font-bold" to="/login" />
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
