<i18n src="../business.json"></i18n>

<script lang="ts" setup>
import type { BusinessProfile } from '#layers/BaseDB/db/schema';
import { useBusinessManager } from '../composables/useBusinessManager';

const props = defineProps<{
  business: BusinessProfile;
}>();
const { t } = useI18n();

const emit = defineEmits(['edit', 'delete', 'select']);
const router = useRouter();

const colors = [
  'bg-violet-700',
  'bg-emerald-700',
  'bg-orange-700',
  'bg-sky-700',
  'bg-pink-700',
  'bg-amber-700',
  'bg-cyan-700',
  'bg-lime-700',
]

const thumbColor = colors[props.business.name.length % colors.length]

const menuActions = [
  {
    label: t('actions.edit'),
    icon: 'i-heroicons-pencil',
    onSelect: () => emit('edit', props.business.id),
  },
  {
    label: 'Google Business',
    icon: 'i-logos-google',
    onSelect: () => router.push(`/app/business/${props.business.id}/gmb`),
  },
  {
    label: t('actions.delete'),
    icon: 'i-heroicons-trash',
    onSelect: () => emit('delete', props.business.id),
  },
];

const { setActiveBusiness, activeBusinessId } = useBusinessManager();

const HandleSetActive = async (id: string) => {
  await setActiveBusiness(id);
  emit('select', id);
};
</script>

<template>
  <UCard
    variant="soft"
    :ui="{
      root: 'cursor-pointer overflow-hidden rounded-xl',
      body: 'p-0 sm:p-0',
    }"
  >
    <div class="relative aspect-video flex items-center justify-center" :class="thumbColor"
    @click="HandleSetActive(business.id)">
      <span class="text-5xl font-bold text-white/20 select-none">
        {{ business.name.charAt(0).toUpperCase() }}
      </span>
      <div class="absolute top-2 right-2">
        <UBadge
          :color="activeBusinessId === business.id ? 'primary' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ activeBusinessId === business.id ? t('states.active') : t('states.inactive') }}
        </UBadge>
      </div>
    </div>

    <div class="p-3 flex items-start gap-2"">
      <div class="min-w-0 flex-1"
    @click="HandleSetActive(business.id)">
        <h3 class="text-sm font-semibold text-[--ui-text-highlighted] line-clamp-2 leading-snug">
          {{ business.name }}
        </h3>

        <p v-if="business.description" class="mt-1 text-xs text-[--ui-text-muted] line-clamp-2 leading-relaxed">
          {{ business.description.length > 100 ? business.description.slice(0, 100) + '...' : business.description }}
        </p>

        <div class="mt-1.5 flex flex-col gap-0.5 text-xs text-[--ui-text-muted]">
          <section v-if="business.address" class="truncate flex items-center gap-1">
            <Icon name="i-heroicons-map-pin-16-solid" class=" size-3" />
            {{ business.address }}
          </section>
          <section v-if="business.website" class="truncate flex items-center gap-1">
            <Icon name="i-heroicons-globe-alt-16-solid" class=" size-3 shrink-0" />
            {{ business.website }}
          </section>
          <section v-if="business.phone" class="truncate flex items-center gap-1">
            <Icon name="i-heroicons-phone-16-solid" class=" size-3 shrink-0" />
            {{ business.phone }}
          </section>
        </div>
      </div>

      <UDropdownMenu :items="menuActions">
        <UButton
          icon="pepicons-pop:dots-y"
          color="neutral"
          variant="ghost"
          size="xs"
          class="text-[--ui-text-muted] hover:text-[--ui-text-highlighted] shrink-0 -mr-1 -mt-1"
        />
      </UDropdownMenu>
    </div>
  </UCard>
</template>
