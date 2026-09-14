<i18n src="../content.json"></i18n>
<script setup lang="ts">
import { ACTION_ICONS, ACTION_I18N, BOARD_ACTIONS, stateColor, type BoardItem } from './board-types'

const props = defineProps<{
  item: BoardItem
  busy?: boolean
}>()

const emit = defineEmits<{
  open: [item: BoardItem]
  action: [item: BoardItem, action: string]
  remove: [item: BoardItem]
  dragstart: [item: BoardItem]
  dragend: []
}>()

const { t } = useI18n()

const cardActions = computed(() => [...(BOARD_ACTIONS[props.item.state] ?? []).map(action => ({
  label: t(`actions.${ACTION_I18N[action]}`),
  icon: ACTION_ICONS[action],
  onSelect: () => emit('action', props.item, action),
})), {
  label: t('actions.delete'),
  icon: 'i-heroicons-trash',
  onSelect: () => emit('remove', props.item),
}])

function handleOpen() {
  emit('open', props.item)
}

function handleDragStart(event: DragEvent) {
  const transfer = event.dataTransfer
  if (transfer) {
    transfer.setData('text/plain', props.item.id)
    transfer.effectAllowed = 'move'
  }
  emit('dragstart', props.item)
}

function handleDragEnd() {
  emit('dragend')
}
</script>

<template>
  <div
    v-motion-fade-visible
    :duration="200"
    class="rounded-xl border border-default bg-elevated p-3 shadow-xs transition hover:border-primary/60"
    :class="{ 'cursor-grab active:cursor-grabbing': !busy, 'opacity-60': busy }"
    :draggable="!busy"
    :data-testid="`board-card-${item.id}`"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <div class="flex items-start gap-2">
      <button type="button" class="min-w-0 flex-1 text-left" @click="handleOpen">
        <p class="truncate text-sm font-medium">{{ item.title }}</p>
        <p v-if="item.brief" class="mt-1 line-clamp-2 text-xs text-muted">{{ item.brief }}</p>
      </button>
      <UDropdownMenu :items="cardActions" :content="{ align: 'end' }">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-ellipsis-horizontal"
          :loading="busy"
          :aria-label="t('actions.details')"
          :data-testid="`board-card-menu-${item.id}`"
        />
      </UDropdownMenu>
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-1">
      <UBadge :color="stateColor(item.state)" variant="subtle" size="xs">
        {{ t(`states.${item.state}`) }}
      </UBadge>
      <UBadge
        v-for="platform in (item.platforms ?? []).slice(0, 3)"
        :key="platform"
        color="neutral"
        variant="outline"
        size="xs"
      >
        {{ platform }}
      </UBadge>
    </div>
  </div>
</template>
