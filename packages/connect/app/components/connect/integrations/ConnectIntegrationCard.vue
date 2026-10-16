<!-- Translation file -->
<i18n src="#site/app/pages/app/integrations/connect.json"></i18n>
<script lang="ts" setup>
import { useConnectionManager } from '../../../composables/connect/integrations/useConnectionManager';
import ConnectPagesModal from './ConnectPagesModal.vue';
import EditConnectionModal from './EditConnectionModal.vue';

interface HealthStatus {
  status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown';
  daysRemaining: number | null;
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
  /** Show the "Edit" action in the menu. */
  showEdit?: boolean;
  health?: HealthStatus;
  platform?: string;
  accountId?: string;
}

const { t, handleDisconnect, HandleReconnect } = useConnectionManager();

const modalStatus = ref(false);

const editModalStatus = ref(false);

const props = withDefaults(defineProps<Props>(), { showPages: true, showMenu: true, showEdit: true, platform: '', accountId: '' });

const reconnectPlatform = computed(() => props.platform || props.name);
const reconnectAccountId = computed(() => props.accountId || props.id || '');
const canReconnect = computed(() => reconnectAccountId.value.length > 0);

const items = computed(() => [
  [
    ...(props.showPages
      ? [
        {
          label: $t('menu.pages'),
          icon: 'i-heroicons-viewfinder-circle',
          onSelect: () => {
            modalStatus.value = true;
          },
        },
      ]
      : []),
    ...(canReconnect.value
      ? [
        {
          label: $t('menu.reconnect'),
          icon: 'i-heroicons-arrow-path',
          onSelect: () => {
            HandleReconnect(reconnectAccountId.value, reconnectPlatform.value);
          },
        },
      ]
      : []),
    {
      label: $t('menu.disconnect'),
      icon: 'i-heroicons-link-slash',
      onSelect: () => {
        handleDisconnect(props.id);
      },
    },
    ...(props.showEdit
      ? [
        {
          label: $t('menu.edit'),
          icon: 'i-heroicons-pencil',
          onSelect: () => {
            editModalStatus.value = true;
          },
        },
      ]
      : []),
  ],
]);

const handleEditSaved = async () => {
  // handled by parent
};

const hasExpiredToken = computed(() => props.health?.status === 'expired');
const isExpiringSoon = computed(() => props.health?.status === 'expiring_soon');
const showReconnectBanner = computed(() => hasExpiredToken.value || isExpiringSoon.value);
</script>

<template>
  <UPageCard :ui="{ body: 'flex-col p-0', root: 'md:min-h-60 p-0', wrapper: 'p-2', container: 'p-0 sm:p-2' }">
    <section class="relative flex flex-col items-center justify-center p-4">
      <div class="relative mb-3">
        <UAvatar :src="props.image" class="size-14 border-2"
          :class="{ 'border-primary': connected, 'border-red-500 animate-pulse': showReconnectBanner }" />
        <span v-if="props.icon" class="absolute -bottom-1.5 -right-1.5 rounded-full ring-2 ring-background inline-flex">
          <UAvatar :icon="props.icon" size="sm" class="bg-white dark:bg-gray-900" />
        </span>
      </div>
      <section class="text-center">
        <h3 class="text-lg font-semibold">{{ props.name }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400"> {{ props.time }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400"> {{ props.tags.join(', ') }}</p>
        <div class="flex items-center justify-center gap-2 mt-2">
          <UBadge v-if="props.connected" color="success" variant="subtle">{{ t('states.connected') }}
          </UBadge>
          <UBadge v-else color="error" variant="subtle">{{ t('states.not_connected') }}</UBadge>
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
            <UTooltip v-else-if="props.health.status === 'expired'" text="Token expired — click Reconnect">
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
        <UButton v-if="showReconnectBanner && canReconnect" color="primary" variant="soft" size="sm" class="mt-3"
          :label="props.health?.status === 'expired' ? 'Token Expired — Reconnect' : 'Token Expiring Soon — Reconnect'"
          icon="i-heroicons-arrow-path" @click="HandleReconnect(reconnectAccountId.value, reconnectPlatform.value)" />
        <UButton v-if="showReconnectBanner && !props.connected && canReconnect" color="red" variant="solid" size="sm"
          class="mt-2" label="Account Inactive — Reconnect" icon="i-heroicons-link-slash"
          @click="HandleReconnect(reconnectAccountId.value, reconnectPlatform.value)" />
      </section>
      <div v-if="props.showMenu" class="absolute top-1 right-1">
        <UDropdownMenu :items="items" :popper="{ placement: 'bottom-start' }">
          <UButton color="neutral" variant="ghost" icon="i-heroicons-ellipsis-vertical-20-solid" />
        </UDropdownMenu>
      </div>
    </section>
  </UPageCard>
  <ConnectPagesModal v-model:open="modalStatus" :platform="reconnectPlatform" :name="props.name" />
  <EditConnectionModal v-model="editModalStatus" :connection-id="props.id" :connection-name="props.name"
    @saved="handleEditSaved" />
</template>
<style scoped></style>
