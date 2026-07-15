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

import { CalendarDate, type DateValue } from '@internationalized/date';
import dayjs from 'dayjs';
import type { Asset, PostCreateBase } from '#layers/BaseDB/db/schema';

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
const postToCreate = ref<PostCreateBase>({
  businessId: '',
  content: '',
  scheduledAt: new Date(),
  status: 'pending',
  platformContent: undefined,
  platformSettings: undefined,
  postFormat: 'post',
  targetPlatforms: [],
  mediaAssets: [],
  comment: []
})
const now = new Date();

const selectedDate = shallowRef(
  new CalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  )
)
const isDateUnavailable = (date: DateValue) => {
  return dayjs(date.toString()).isBefore(dayjs().add(-1, 'day'));
}
const selectedTime = ref(dayjs(postToCreate.value.scheduledAt).format('HH:mm'));

watch([selectedDate, selectedTime], () => {
  postToCreate.value.scheduledAt = dayjs(`${selectedDate.value}T${selectedTime.value}`).toDate();
});

const formattedScheduledAt = computed(() =>
  dayjs(postToCreate.value.scheduledAt).format('DD/MM/YYYY HH:mm')
);


const inputTabs = computed(() => [
  { label: t('input.contentTab'), value: 'content' as const, icon: 'i-heroicons-document-text' },
  { label: t('input.urlTab'), value: 'url' as const, icon: 'i-heroicons-link' },
]);

const resultPlatforms = computed(() => results.value ?? {});
const isResultsEmpty = computed(() => Object.keys(resultPlatforms.value).length === 0);


const handleCreatePostNow = async () => {
  //Add selected assets to post
  postToCreate.value.mediaAssets = selectedAssets.value.map(asset => asset.id);

  const state = postToCreate.value.content.length < 0;

  if (state) {
    toast.add({ title: t('validation.noPlatformSelected'), color: 'warning' });
    return;
  }

  try {
    isLoading.value = true
    postToCreate.value.businessId = activeBusinessId.value ?? '';

    await createPost(postToCreate.value);

    toast.add({ title: 'Post scheduled successfully!', color: 'success' });
  } catch (e: any) {
    console.error(e);
  } finally {
    isLoading.value = false
  }
};




const handleTogglePlatform = (account: { id: string, platform: string }) => {
  //Check if the postToCreate has content
  const haveContent = postToCreate.value.content.length > 0;
  const resultHaveContentForPlatform = resultPlatforms.value[account.platform as any];
  console.log(resultPlatforms.value);
  console.log(resultHaveContentForPlatform);

  if (!resultHaveContentForPlatform) {
    toast.add({ title: t('validation.noPlatformSelected'), color: 'warning' });
    return;
  }
  if (!haveContent) {
    postToCreate.value.content = resultHaveContentForPlatform.content;
  }

  const index = localSelectedPlatforms.value.indexOf(account.id)
  if (index > -1) {
    localSelectedPlatforms.value.splice(index, 1)
  } else {
    localSelectedPlatforms.value.push(account.id)
  }

  //add the content as override for the postToCreate
  postToCreate.value.targetPlatforms = localSelectedPlatforms.value
  postToCreate.value.platformContent = {
    ...postToCreate.value.platformContent,
    [account.platform]: {
      content: resultHaveContentForPlatform.content,
      comments: resultHaveContentForPlatform.comments
    }
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

            <div v-if="isResultsEmpty" class="text-center py-12 text-muted">
              <Icon name="lucide:file-text" class="size-12 mx-auto mb-4 opacity-50" />
              <p>{{ t('results.noResults') }}</p>
            </div>

            <UTabs v-else :items="Object.keys(results).map(p => ({ label: '', icon: `logos:${p}`, slot: p }))"
              class="w-full">
              <template v-for="(platform, key) in results" :key="key" #[key]>
                <div class="py-4 space-y-4">
                  <div class="prose prose-sm dark:prose-invert max-w-none">
                    <template v-if="platform.content">
                      <div class="p-3 rounded-lg bg-muted/50 mb-2">
                        <p class="whitespace-pre-wrap">{{ platform.content }}</p>
                      </div>
                    </template>
                    <template v-for="comment in platform.comments">
                      <div class="p-3 rounded-lg bg-muted/50 my-2">
                        <p class="whitespace-pre-wrap">{{ comment }}</p>
                      </div>
                    </template>
                  </div>

                  <div class="flex gap-2 mb-4">
                    <UButton variant="outline" color="neutral" icon="i-heroicons-clipboard-document"
                      @click="copyToClipboard(getContentAsString(key))">
                      {{ t('results.copy') }}
                    </UButton>
                  </div>

                  <hr class="border-gray-200 dark:border-gray-800 my-4" />


                </div>
              </template>
            </UTabs>
            <!-- Create Post Direct UI -->
            <div class="space-y-4" v-if="!isResultsEmpty">
              <h4 class="font-semibold">{{ t('results.useForPost') }}</h4>

              <div class="space-y-2">
                <PlatformSelector :accounts="connectedSocialAccountsList" :selected-ids="localSelectedPlatforms"
                  @toggle="handleTogglePlatform" />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">{{ t('results.schedule') }}</label>
                <UPopover>
                  <UButton icon="i-heroicons-calendar" variant="outline" color="neutral" block class="justify-start">
                    <span class="text-sm cursor-pointer hover:text-primary">
                      {{ formattedScheduledAt }}
                    </span>
                  </UButton>
                  <template #content>
                    <div class="p-4 space-y-4">
                      <UCalendar v-model="selectedDate" :is-date-unavailable="isDateUnavailable" />
                      <UInput v-model="selectedTime" type="time" />
                    </div>
                  </template>
                </UPopover>
              </div>

              <div class="space-y-2 my-2">
                <MediaGalleryForUser v-model:selected="selectedAssets" />
              </div>
              <UButton color="primary" block size="lg" @click="handleCreatePostNow">
                {{ t('results.schedulePost') }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
