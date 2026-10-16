<i18n src="#site/app/pages/app/business/business.json"></i18n>

<script lang="ts" setup>
import type { BusinessProfile } from '#layers/BaseDB/db/schema';
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';

const props = defineProps<{
  business: BusinessProfile;
}>();

const emit = defineEmits(['edit', 'delete', 'select']);
const { t } = useI18n();
const router = useRouter();
const { setActiveBusiness, activeBusinessId } = useBusinessManager();

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

const initial = computed(() => props.business.name.charAt(0).toUpperCase() || '?')
const thumbColor = computed(() => colors[props.business.name.length % colors.length])
const isActive = computed(() => activeBusinessId.value === props.business.id)

/** One quiet line: website, else category, else a short description. */
const subtitle = computed(() => {
  const { website, category, description } = props.business
  if (website) return website
  if (category) return category
  return description ? description.slice(0, 80) : ''
})

const handleSetActive = async (id: string) => {
  await setActiveBusiness(id);
  emit('select', id);
};

function handleEdit() {
  emit('edit', props.business.id)
}

function handleDelete() {
  emit('delete', props.business.id)
}

function handleOpenPlaybook() {
  router.push(`/app/business/${props.business.id}/content/playbook`)
}

function handleOpenGmb() {
  router.push(`/app/business/${props.business.id}/gmb`)
}

/** Actions collapse into one menu — the card stays a card, not a toolbar. */
const menuItems = computed(() => [[
  { label: t('actions.edit'), icon: 'i-heroicons-pencil', onSelect: handleEdit },
  { label: t('actions.playbook'), icon: 'i-lucide-book-open', onSelect: handleOpenPlaybook },
  { label: t('actions.google_business'), icon: 'i-logos-google', onSelect: handleOpenGmb },
], [
  { label: t('actions.delete'), icon: 'i-heroicons-trash', color: 'error' as const, onSelect: handleDelete },
]])
</script>

<template>
  <UCard
    variant="soft"
    :ui="{ root: 'rounded-xl', body: 'p-3' }"
  >
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white/80 transition-transform hover:scale-105"
        :class="thumbColor"
        :aria-label="business.name"
        @click="handleSetActive(business.id)"
      >
        {{ initial }}
      </button>

      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="handleSetActive(business.id)"
      >
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-semibold text-highlighted">{{ business.name }}</h3>
          <UBadge v-if="isActive" color="primary" variant="subtle" size="xs">
            {{ t('states.active') }}
          </UBadge>
        </div>
        <p class="truncate text-xs text-muted">{{ subtitle || t('states.no_details') }}</p>
      </button>

      <div @click.stop>
        <UDropdownMenu :items="menuItems">
          <UButton
            icon="i-heroicons-ellipsis-horizontal"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('actions.more')"
          />
        </UDropdownMenu>
      </div>
    </div>
  </UCard>
</template>
