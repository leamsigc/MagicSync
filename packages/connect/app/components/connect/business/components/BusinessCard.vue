<i18n src="#site/app/pages/app/business/business.json"></i18n>

<script lang="ts" setup>
import type { BusinessProfile } from '#layers/BaseDB/db/schema';
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';

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

const { setActiveBusiness, activeBusinessId } = useBusinessManager();

const handleSetActive = async (id: string) => {
  await setActiveBusiness(id);
  emit('select', id);
};

const handleEdit = () => emit('edit', props.business.id);
const handleDelete = () => emit('delete', props.business.id);
const handleOpenPlaybook = () => router.push(`/app/business/${props.business.id}/playbook`);
const handleOpenGmb = () => router.push(`/app/business/${props.business.id}/gmb`);

interface CardAction {
  icon: string
  label: string
  danger?: boolean
  onClick: () => void
}

const cardActions: CardAction[] = [
  { icon: 'i-heroicons-pencil', label: t('actions.edit'), onClick: handleEdit },
  { icon: 'i-lucide-book-open', label: t('actions.playbook'), onClick: handleOpenPlaybook },
  { icon: 'i-logos-google', label: t('actions.google_business'), onClick: handleOpenGmb },
  { icon: 'i-heroicons-trash', label: t('actions.delete'), danger: true, onClick: handleDelete },
]
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
    @click="handleSetActive(business.id)">
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

    <div class="p-3">
      <div
        @click="handleSetActive(business.id)"
      >
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

      <div class="mt-2 flex items-center justify-between gap-1">
        <UTooltip
          v-for="action in cardActions"
          :key="action.label"
          :text="action.label"
        >
          <UButton
            :icon="action.icon"
            color="neutral"
            variant="ghost"
            size="xs"
            :class="action.danger ? 'text-[--ui-text-muted] hover:text-red-500' : 'text-[--ui-text-muted] hover:text-[--ui-text-highlighted]'"
            :aria-label="action.label"
            @click="action.onClick"
          />
        </UTooltip>
      </div>
    </div>
  </UCard>
</template>
