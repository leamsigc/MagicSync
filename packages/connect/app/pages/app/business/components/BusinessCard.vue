<!--  Translation file -->
<i18n src="../business.json"></i18n>

<script lang="ts" setup>
import type { BusinessProfile } from '#layers/BaseDB/db/schema';
import { useBusinessManager } from '../composables/useBusinessManager';


const props = defineProps<{
  business: BusinessProfile;
}>();
const { t } = useI18n();

const emit = defineEmits(['edit', 'delete']);
const menuActions = [
  {
    label: t('actions.edit'),
    icon: 'i-heroicons-pencil',
    onClick: () => emit('edit'),
  },
  {
    label: t('actions.delete'),
    icon: 'i-heroicons-trash',
    onClick: () => emit('delete'),
  },
];
const { setActiveBusiness, activeBusinessId } = useBusinessManager();
const router = useRouter();


const HandleSetActive = async (id: string) => {
  await setActiveBusiness(id);
  router.push('/app');
};
</script>

<template>
  <UCard variant="soft" class="cursor-pointer size-56"
    :ui="{ header: 'p-0 sm:p-2', footer: 'p-0 sm:p-2', body: 'p-0 sm:p-0 h-full', root: 'p-0' }">
    <div class="relative  h-full">
      <section class="flex justify-end z-10 absolute top-2 right-2">
        <UChip :color="activeBusinessId === business.id ? 'primary' : 'neutral'" class="mr-2">
          <UBadge :color="activeBusinessId === business.id ? 'primary' : 'neutral'" variant="subtle">
            {{ activeBusinessId === business.id ? t('states.active') : t('states.inactive') }}
          </UBadge>
        </UChip>
        <UDropdownMenu :items="menuActions">
          <UButton icon="pepicons-pop:dots-y" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </section>
      <NuxtImg :src="'https://must-know-resources-for-programmers.giessen.dev/_ipx/q_75&s_160x60/logo.png'"
        class="w-full h-full object-cover absolute inset-0 opacity-5" @click="HandleSetActive(business.id)" />
      <section class="flex mt-auto absolute bottom-0 left-0 right-0 bg-old-neutral-950/20 p-2 ">
        <div class="flex-1">
          <h3 class="text-lg font-semibold">{{ business.name }}</h3>
          <p class="text-sm text-muted">{{ business.description }}</p>
        </div>
      </section>
    </div>
  </UCard>
</template>
