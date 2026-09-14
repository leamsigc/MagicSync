<i18n src="../content.json"></i18n>
<script setup lang="ts">
import BoardCard from './BoardCard.vue'
import type { BoardColumnDef, BoardItem } from './board-types'
import { dropActionFor } from './board-types'

const props = defineProps<{
  column: BoardColumnDef
  items: BoardItem[]
  busyId: string | null
  dragItem: BoardItem | null
}>()

const emit = defineEmits<{
  open: [item: BoardItem]
  action: [item: BoardItem, action: string]
  remove: [item: BoardItem]
  pickup: [item: BoardItem]
  release: []
  dropinvalid: [item: BoardItem]
}>()

const { t } = useI18n()

const over = ref(false)

const cards = computed(() => props.items.filter(item => props.column.states.includes(item.state)))

const canDrop = computed(() => props.dragItem ? dropActionFor(props.dragItem.state, props.column.key) !== null : false)

const showTarget = computed(() => over.value && canDrop.value && props.dragItem !== null)

function handleOpen(item: BoardItem) {
  emit('open', item)
}

function handleAction(item: BoardItem, action: string) {
  emit('action', item, action)
}

function handleRemove(item: BoardItem) {
  emit('remove', item)
}

function handlePickup(item: BoardItem) {
  emit('pickup', item)
}

function handleRelease() {
  over.value = false
  emit('release')
}

function handleDragHover() {
  if (canDrop.value) over.value = true
}

function handleDragLeave() {
  over.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  over.value = false
  const item = props.dragItem
  if (!item) return
  const action = dropActionFor(item.state, props.column.key)
  if (!action) {
    emit('dropinvalid', item)
    return
  }
  emit('action', item, action)
}

watch(() => props.dragItem, (item) => {
  if (!item) over.value = false
})
</script>

<template>
  <section
    v-motion-fade-visible
    :duration="200"
    class="flex w-[80vw] shrink-0 snap-start flex-col rounded-2xl border border-default bg-default/60 sm:w-72"
    :class="{ 'border-primary/70 bg-primary/5': showTarget }"
    :data-testid="`board-column-${column.key}`"
  >
    <header class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
      <h2 class="text-sm font-semibold">{{ t(`columns.${column.key}`) }}</h2>
      <UBadge color="neutral" variant="subtle" size="xs">{{ cards.length }}</UBadge>
    </header>
    <div
      class="flex max-h-[65vh] flex-1 flex-col gap-2 overflow-y-auto p-2"
      @dragenter="handleDragHover"
      @dragover.prevent="handleDragHover"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <BoardCard
        v-for="item in cards"
        :key="item.id"
        :item="item"
        :busy="busyId === item.id"
        @open="handleOpen"
        @action="handleAction"
        @remove="handleRemove"
        @dragstart="handlePickup"
        @dragend="handleRelease"
      />
      <p v-if="cards.length === 0" class="px-1 py-6 text-center text-xs text-muted">
        {{ t('empty.filtered') }}
      </p>
    </div>
  </section>
</template>
