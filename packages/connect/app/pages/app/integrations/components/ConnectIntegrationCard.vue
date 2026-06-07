<!--  Translation file -->
<i18n src="../connect.json"></i18n>
<script lang="ts" setup>
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';
import type { LinkedInPage } from '#layers/BaseConnect/utils/LinkedInPages';
import { useConnectionManager } from '../composables/useConnectionManager';
import EditConnectionModal from './EditConnectionModal.vue';

/**
 *
 * Integration card
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

interface HealthStatus {
  status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown'
  daysRemaining: number | null
}

interface Props {
  id: string;
  name: string;
  image: string;
  connected: boolean;
  time: string;
  icon?: string;
  tags: string[];
  showPages?: boolean;
  showMenu?: boolean;
  health?: HealthStatus;
}
const { getPagesForIntegration, HandleConnectToFacebook, facebookPages, handleDisconnect, HandleConnectToLinkedIn, getAllSocialMediaAccounts } = useConnectionManager();

const modalStatus = ref(false);
const toggleModal = () => {
  modalStatus.value = !modalStatus.value;
};

const editModalStatus = ref(false);

const props = withDefaults(defineProps<Props>(), { showPages: true, showMenu: true });

const items = computed(() => [
  [
    ...(props.showPages ? [{
      label: $t('menu.pages'),
      icon: 'i-heroicons-viewfinder-circle',
      onSelect: async () => {
        console.log("Get all pages for the current user", props.name);
        //Get all pages for the integration
        await getPagesForIntegration(props.name);
        toggleModal();
      },
    }] : []),
    {
      label: $t('menu.reconnect'),
      icon: 'i-heroicons-arrow-path',
      onSelect: () => {
        // Handle reconnect action
        console.log('Reconnect onSelected');
      },
    }, {
      label: $t('menu.disconnect'),
      icon: 'i-heroicons-link-slash',
      onSelect: () => {
        // Handle disconnect action
        handleDisconnect(props.id);
      },
    }, {
      label: $t('menu.edit'),
      icon: 'i-heroicons-pencil',
      onSelect: () => {
        // Handle edit action
        editModalStatus.value = true;
      },
    }]
]);

const HandleConnectTo = async (page: unknown) => {
  if (props.name === 'facebook') {
    await HandleConnectToFacebook(page as FacebookPage);
  } else if (props.name === 'linkedin-page') {
    await HandleConnectToLinkedIn(page as LinkedInPage);
  }

  toggleModal();
};

const handleEditSaved = async () => {
  await getAllSocialMediaAccounts();
};
</script>

<template>
  <UPageCard :ui="{ body: 'flex-col p-0', root: 'md:min-h-60 p-0', wrapper: 'p-2', container: 'p-0 sm:p-2' }">
    <section class="relative flex flex-col items-center justify-center p-2">
      <UAvatar :src="props.image" class="w-12 h-12 border-2 relative" :class="{ 'border-primary': connected }" />
      <div v-if="props.icon" class="">
        <UAvatar :icon="props.icon === 'logos:linkedin-page' ? 'logos:linkedin' : props.icon" size="2xl"
          class="bg-white dark:bg-gray-900" />
      </div>
      <section class="text-center">
        <h3 class="text-lg font-semibold">{{ props.name }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400"> {{ props.time }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400"> {{ props.tags.join(', ') }}</p>
        <div class="flex items-center justify-center gap-2 mt-2">
          <UBadge v-if="props.connected" color="success" variant="subtle">{{ $t('states.connected') }}
          </UBadge>
          <UBadge v-else color="error" variant="subtle">{{ $t('states.not_connected') }}</UBadge>
          <template v-if="props.health && props.connected">
            <UTooltip v-if="props.health.status === 'healthy'" text="Token valid">
              <span class="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <span class="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400" />
              </span>
            </UTooltip>
            <UTooltip v-else-if="props.health.status === 'expiring_soon'"
              :text="`Expires in ${props.health.daysRemaining} day${props.health.daysRemaining === 1 ? '' : 's'}`">
              <span class="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                <span class="w-2 h-2 rounded-full bg-yellow-600 dark:bg-yellow-400" />
                <span class="font-medium">{{ props.health.daysRemaining }}d</span>
              </span>
            </UTooltip>
            <UTooltip v-else-if="props.health.status === 'expired'" text="Token expired — reconnect">
              <span class="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <span class="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400 animate-pulse" />
                <span class="font-medium">Expired</span>
              </span>
            </UTooltip>
            <UTooltip v-else text="Token expiry unknown">
              <span class="inline-flex items-center gap-1 text-xs text-gray-400">
                <span class="w-2 h-2 rounded-full bg-gray-400" />
              </span>
            </UTooltip>
          </template>
        </div>
      </section>
      <div class="absolute top-1 right-1" v-if="props.showMenu">
        <UDropdownMenu :items="items" :popper="{ placement: 'bottom-start' }">
          <UButton color="neutral" variant="ghost" icon="i-heroicons-ellipsis-vertical-20-solid" />
        </UDropdownMenu>
      </div>
    </section>
  </UPageCard>
  <UModal v-model:open="modalStatus" :title="$t('modal.select_page_title')"
    :description="$t('modal.select_page_description')" class="md:min-w-4xl">

    <template #body>
      <section class="grid md:grid-cols-3 gap-2">
        <UPageCard
          :ui="{ body: 'sm:p-0 p-0', root: 'sm:p-0 p-0 cursor-pointer', wrapper: 'p-0', container: 'p-0 sm:p-0' }"
          v-for="page in facebookPages" :key="page.id" @click="HandleConnectTo(page)">
          <section class="relative flex flex-col items-center justify-center p-4">
            <UAvatar :src="page.imageBase64 || page.picture.data.url" class="size-20 border border-primary relative" />
            <section class="text-center">
              <h3 class="text-lg font-semibold">{{ page.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('modal.id_label') }}{{ page.id }}</p>
              <Icon v-if="page.instagram_business_account?.id" name="logos:instagram" />
              <Icon v-else-if="props.icon === 'logos:linkedin-page'" name="logos:linkedin" class="mr-4" />
              <Icon v-else name="logos:facebook" class="mr-4" />
            </section>
          </section>
        </UPageCard>
      </section>
    </template>
  </UModal>
  <EditConnectionModal v-model="editModalStatus" :connectionId="props.id" :connectionName="props.name"
    @saved="handleEditSaved" />
</template>
<style scoped></style>
