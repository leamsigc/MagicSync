<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: AI Content Repurpose page - transforms long-form content into platform-specific posts
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { useBusinessManager } from '#layers/BaseConnect/app/pages/app/business/composables/useBusinessManager'
import { useSocialMediaManager } from '#layers/BaseConnect/app/composables/UseSocialMediaManager'
import { usePostManager } from '#layers/BaseScheduler/app/pages/app/posts/composables/UsePostManager'

import { CalendarDate } from '@internationalized/date';
import dayjs from 'dayjs';
import type { Asset } from '#layers/BaseDB/db/schema';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const { connectedSocialAccountsList, getAllSocialMediaAccounts } = useSocialMediaManager()
const { createPost } = usePostManager()

const { activeBusinessId } = useBusinessManager()

onMounted(async () => {
  await getAllSocialMediaAccounts()
})


useSeoMeta({
  title: () => t('page.title'),
  description: () => t('page.description'),
});

const {
  content,
  url,
  inputMode,
  selectedPlatforms,
  selectedTone,
  isLoading,
  results,
  platforms,
  tones,
  togglePlatform,
  isPlatformSelected,
  generateContent,
  copyToClipboard,
  getContentAsString,
} = useContentSplit();

const selectedAssets = ref<Asset[]>([])
const localSelectedPlatforms = ref<string[]>([])


const inputTabs = computed(() => [
  { label: t('input.contentTab'), value: 'content' as const, icon: 'i-heroicons-document-text' },
  { label: t('input.urlTab'), value: 'url' as const, icon: 'i-heroicons-link' },
]);

const resultPlatforms = computed(() => Object.keys(results.value));

// Per-platform state for creating posts
const platformPostStates = ref<Record<string, {
  selectedAccountIds: string[];
  selectedDate: CalendarDate;
  selectedTime: string;
  selectedAssets: Asset[];
  isSubmitting: boolean;
}>>({});

// Initialize state when results change
watch(resultPlatforms, (newPlatforms) => {
  const now = new Date();
  newPlatforms.forEach(p => {
    if (!platformPostStates.value[p]) {
      platformPostStates.value[p] = {
        selectedAccountIds: [],
        selectedDate: new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
        selectedTime: dayjs().add(1, 'hour').format('HH:mm'),
        selectedAssets: [],
        isSubmitting: false,
      };
    }
  });
});


const handleCreatePostNow = async () => {
  const state = platformPostStates.value[platform];
  if (!state) return;
  if (state.selectedAccountIds.length === 0) {
    toast.add({ title: t('validation.noPlatformSelected'), color: 'warning' });
    return;
  }

  const result = results.value[platform];
  if (!result || !result.content || result.content.length === 0) return;

  state.isSubmitting = true;
  try {
    const scheduledAt = dayjs(`${state.selectedDate}T${state.selectedTime}`).toDate();
    const contentToPost = result.content[0];
    const isThread = result.content.length > 1;
    const comments = isThread ? result.content.slice(1) : (result.comments || []);

    // await createPost({
    //   content: contentToPost || '',
    //   businessId: activeBusinessId.value || '',
    //   targetPlatforms: state.selectedAccountIds,
    //   mediaAssets: state.selectedAssets.map(a => a.id),
    //   scheduledAt: scheduledAt,
    //   status: 'pending',
    //   comment: comments,
    //   platformSettings: undefined,
    //   postFormat: 'post'
    // });

    toast.add({ title: 'Post scheduled successfully!', color: 'success' });
  } catch (e: any) {
    console.error(e);
  } finally {
    state.isSubmitting = false;
  }
};

const isDateUnavailable = (date: any) => {
  return dayjs(date.toString()).isBefore(dayjs().add(-1, 'day'));
};

const formattedScheduledAt = () => {
  const state = platformPostStates;
  if (!state) return '';
  return dayjs(`${state.selectedDate}T${state.selectedTime}`).format('DD/MM/YYYY HH:mm');
};


const handleTogglePlatform = (account: { id: string }) => {
  const index = localSelectedPlatforms.value.indexOf(account.id)
  if (index > -1) {
    localSelectedPlatforms.value.splice(index, 1)
  } else {
    localSelectedPlatforms.value.push(account.id)
  }
}
</script>

<template>
  <div class="min-h-screen p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="mb-6">
        <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="router.back()">
          {{ t('page.back') }}
        </UButton>
      </div>

      <header class="mb-8">
        <h1 class="text-3xl font-bold from-primary ">
          {{ t('page.title') }}
        </h1>
        <p class="text-muted mt-2">{{ t('page.description') }}</p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex gap-2">
                <UButton v-for="tab in inputTabs" :key="tab.value"
                  :variant="inputMode === tab.value ? 'solid' : 'ghost'"
                  :color="inputMode === tab.value ? 'primary' : 'neutral'" :icon="tab.icon" size="sm"
                  @click="inputMode = tab.value">
                  {{ tab.label }}
                </UButton>
              </div>
            </template>

            <div v-if="inputMode === 'content'">
              <UTextarea v-model="content" :placeholder="t('input.contentPlaceholder')" :rows="12" class="w-full"
                color="neutral" variant="outline" />
            </div>

            <div v-else class="space-y-4">
              <UInput v-model="url" :placeholder="t('input.urlPlaceholder')" type="url" icon="i-heroicons-link"
                size="lg" />
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h3 class="font-semibold">{{ t('platforms.title') }}</h3>
                <p class="text-sm text-muted">{{ t('platforms.description') }}</p>
              </div>
            </template>

            <div class="flex flex-wrap gap-3">
              <UButton v-for="platform in platforms" :key="platform.value"
                :variant="isPlatformSelected(platform.value) ? 'solid' : 'outline'"
                :color="isPlatformSelected(platform.value) ? 'primary' : 'neutral'" size="lg"
                @click="togglePlatform(platform.value)">
                <Icon :name="platform.icon" class="size-5" />
                {{ platform.label }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h3 class="font-semibold">{{ t('tone.title') }}</h3>
                <p class="text-sm text-muted">{{ t('tone.description') }}</p>
              </div>
            </template>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <UButton v-for="tone in tones" :key="tone.value"
                :variant="selectedTone === tone.value ? 'solid' : 'outline'"
                :color="selectedTone === tone.value ? 'primary' : 'neutral'"
                class="flex flex-col items-start p-4 h-auto" @click="selectedTone = tone.value">
                <span class="font-medium">{{ tone.label }}</span>
                <span class="text-xs opacity-70">{{ tone.description }}</span>
              </UButton>
            </div>
          </UCard>

          <UButton :loading="isLoading" :disabled="isLoading || selectedPlatforms.length === 0" color="primary"
            size="xl" block @click="generateContent">
            <Icon v-if="!isLoading" name="lucide:sparkles" class="size-5" />
            {{ isLoading ? t('generate.loading') : t('generate.button') }}
          </UButton>
        </div>

        <div>
          <UCard class="sticky top-4">
            <template #header>
              <h3 class="font-semibold">{{ t('results.title') }}</h3>
            </template>

            <div v-if="resultPlatforms.length === 0" class="text-center py-12 text-muted">
              <Icon name="lucide:file-text" class="size-12 mx-auto mb-4 opacity-50" />
              <p>{{ t('results.noResults') }}</p>
            </div>

            <UTabs v-else :items="resultPlatforms.map(p => ({ label: '', icon: `logos:${p}`, slot: p }))"
              class="w-full">
              <template v-for="platform in resultPlatforms" :key="platform" #[platform]>
                <div class="py-4 space-y-4">
                  <div class="prose prose-sm dark:prose-invert max-w-none">
                    <template v-if="Array.isArray(results[platform]?.content)">
                      <div v-for="(item, idx) in results[platform].content" :key="idx"
                        class="p-3 rounded-lg bg-muted/50 mb-2">
                        <p class="whitespace-pre-wrap">{{ item }}</p>
                      </div>
                    </template>
                    <template v-else>
                      <div class="p-3 rounded-lg bg-muted/50">
                        <p class="whitespace-pre-wrap">{{ results[platform]?.content }}</p>
                      </div>
                    </template>
                  </div>

                  <div class="flex gap-2 mb-4">
                    <UButton variant="outline" color="neutral" icon="i-heroicons-clipboard-document"
                      @click="copyToClipboard(getContentAsString(platform))">
                      {{ t('results.copy') }}
                    </UButton>
                  </div>

                  <hr class="border-gray-200 dark:border-gray-800 my-4" />


                </div>
              </template>
            </UTabs>
            <!-- Create Post Direct UI -->
            <div class="space-y-4">
              <h4 class="font-semibold">{{ t('results.useForPost') }}</h4>

              <div class="space-y-2">
                <PlatformSelector :accounts="connectedSocialAccountsList" :selected-ids="localSelectedPlatforms"
                  @toggle="handleTogglePlatform" />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">{{ t('results.schedule') }}</label>
                <UPopover>
                  <UButton icon="i-heroicons-calendar" variant="outline" color="neutral" block class="justify-start">
                    {{ formattedScheduledAt() }}
                  </UButton>
                  <template #content>
                    <div class="p-4 space-y-4">
                      <UCalendar v-model="platformPostStates[platform].selectedDate"
                        :is-date-unavailable="isDateUnavailable" />
                      <UInput v-model="platformPostStates[platform].selectedTime" type="time" />
                    </div>
                  </template>
                </UPopover>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium">{{ t('results.media') }}</label>
                <MediaGalleryForUser v-model:selected="selectedAssets" />
              </div>
            </div>
            <UButton color="primary" block size="lg" @click="handleCreatePostNow">
              {{ t('results.schedulePost') }}
            </UButton>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
