<!-- Translation file -->
<i18n src="#site/app/pages/app/integrations/connect.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Page picker for a connected provider.
 * Loads the provider's pages and connects the one the user selects. Extracted
 * from `ConnectIntegrationCard` so the grid card and the directory's
 * list/table actions share one implementation.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import type { FacebookPage } from '../../../../utils/FacebookPages';
import type { LinkedInPage } from '../../../../utils/LinkedInPages';
import { useConnectionManager } from '../../../composables/connect/integrations/useConnectionManager';

const props = withDefaults(defineProps<{
  /** Provider id used to fetch pages (e.g. `facebook`, `linkedin-page`). */
  platform?: string
  /** Provider name used to route the connect handler. */
  name?: string
}>(), { platform: '', name: '' })

const open = defineModel<boolean>('open', { default: false })

const {
  t,
  getPagesForIntegration,
  facebookPages,
  HandleConnectToFacebook,
  HandleConnectToLinkedIn,
  HandleConnectToYoutube,
  HandleConnectToGMB,
} = useConnectionManager()
const toast = useToast()

watch(open, async (value) => {
  if (!value || !props.platform) return
  try {
    await getPagesForIntegration(props.platform)
  } catch {
    // getPagesForIntegration already raises its own error toast
  }
})

const HandleConnectTo = async (page: unknown) => {
  const pageWithType = page as FacebookPage & { platformType?: string };
  // Fall back to the provider's own platform: some pages payloads omit
  // platformType, and a silent no-op here used to just close the modal
  // with no account created.
  const platformType = pageWithType.platformType || props.platform || '';

  try {
    if (platformType === 'youtube') {
      await HandleConnectToYoutube(pageWithType);
    } else if (platformType === 'googlemybusiness') {
      await HandleConnectToGMB(pageWithType);
    } else if (props.name === 'facebook') {
      await HandleConnectToFacebook(page as FacebookPage);
    } else if (props.name === 'linkedin-page' || platformType === 'linkedin-page') {
      await HandleConnectToLinkedIn(page as LinkedInPage);
    } else {
      toast.add({
        title: t('messages.unsupported_page.title'),
        description: t('messages.unsupported_page.description', { provider: props.name }),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      });
    }
  } catch {
    // Error toast already handled by the respective handler
  } finally {
    open.value = false;
  }
};
</script>

<template>
  <UModal v-model:open="open" :title="t('modal.select_page_title')"
    :description="t('modal.select_page_description')" class="md:min-w-4xl">
    <template #body>
      <section class="grid md:grid-cols-3 gap-2">
        <UPageCard v-for="page in facebookPages" :key="page.id"
          :ui="{ body: 'sm:p-0 p-0', root: 'sm:p-0 p-0 cursor-pointer', wrapper: 'p-0', container: 'p-0 sm:p-0' }"
          @click="HandleConnectTo(page)">
          <section class="relative flex flex-col items-center justify-center p-4">
            <UAvatar :src="page.imageBase64 || page.picture.data.url" class="size-20 border border-primary relative" />
            <section class="text-center">
              <h3 class="text-lg font-semibold">{{ page.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('modal.id_label') }}{{ page.id }}</p>
              <Icon v-if="page.instagram_business_account?.id" name="logos:instagram" />
              <Icon v-else-if="page.platformType === 'linkedin-page'" name="logos:linkedin" class="mr-4" />
              <Icon v-else-if="page.platformType === 'youtube'" name="logos:youtube" class="mr-4" />
              <Icon v-else-if="page.platformType === 'googlemybusiness'" name="logos:google" class="mr-4" />
              <Icon v-else name="logos:facebook" class="mr-4" />
            </section>
          </section>
        </UPageCard>
      </section>
    </template>
  </UModal>
</template>

<style scoped></style>
