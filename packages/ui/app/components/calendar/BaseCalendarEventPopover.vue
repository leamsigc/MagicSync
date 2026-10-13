<!--  Translation file -->
<i18n src="./BaseCalendarEventPopover.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: Context menu plus popover wrapper for one event.
 *
 * Both mount lazily: a popover and a context menu are what a single event costs
 * to render, and the month grid puts a few hundred of them on screen at once.
 * Neither is worth anything until an event is actually pointed at, so they mount
 * on the first interaction that could reach them. Starting out unarmed also
 * keeps their generated ids off the server render, where they would not be
 * stable across the boundary.
 *
 * The form body is a `#event-form` slot: the generic grid owns the chrome, the
 * caller owns the form and its persistence.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { ContextMenuItem } from '@nuxt/ui'
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  event: CalendarEvent
  /** Suppresses the popover for the click that ended a drag. */
  disabled?: boolean
  /** The segment that owns the form, for an event drawn across more than one day. */
  anchored?: boolean
  /** Id of the event the caller wants open, so a redraw does not close the form. */
  editingId?: string
}>(), { anchored: true })

const emit = defineEmits<{
  open: [id: string]
  close: []
  update: [event: CalendarEvent]
  remove: [event: CalendarEvent]
}>()

const { formSide } = useCalendarRange()

const armed = ref(false)
const root = useTemplateRef('root')

function arm(event: Event) {
  if (armed.value) {
    return
  }

  armed.value = true

  // Arming swaps the event out for the wrapped copy, so a keyboard user tabbing
  // onto it has to be handed the one taking its place
  if (event.type === 'focusin') {
    nextTick(() => root.value?.querySelector<HTMLElement>('[data-event]')?.focus())
  }
}

const open = computed(() => props.anchored && props.editingId === props.event.id)
const active = computed(() => armed.value || open.value)

function onUpdateOpen(value: boolean) {
  if (props.disabled) {
    return
  }

  if (value) {
    emit('open', props.event.id)
  } else {
    emit('close')
  }
}

function requestClose() {
  emit('close')
}

function onRemove() {
  emit('close')
  emit('remove', props.event)
}

const items = computed<ContextMenuItem[]>(() => [{
  label: t('edit'),
  icon: 'i-lucide-pencil',
  onSelect: () => emit('open', props.event.id)
}, {
  label: t('remove'),
  icon: 'i-lucide-trash-2',
  color: 'error',
  onSelect: onRemove
}])
</script>

<template>
  <!-- Held across the swap so the focus has somewhere to go back to. `contents`
    keeps it out of the layout, on both this one and the one below -->
  <div
    ref="root"
    class="contents"
    @pointerover="arm"
    @focusin="arm"
    @contextmenu="arm"
  >
    <slot
      v-if="!active"
      :open="false"
    />

    <!-- `as-child` drops its handlers on a component that renders a fragment, so
      the two triggers need a real element between them, and the trigger stays
      the event itself -->
    <UContextMenu
      v-else
      :items="items"
      :disabled="disabled"
      size="sm"
    >
      <div class="contents">
        <!-- The event opens straight into the form, so there is no read-only
          step between pointing at an event and changing it. The content only
          mounts while it is open, which re-seeds it every time -->
        <UPopover
          :open="open"
          :ui="{ content: 'p-2 w-74' }"
          :content="{ side: formSide }"
          @update:open="onUpdateOpen"
        >
          <slot :open="open" />

          <template #content>
            <slot
              name="event-form"
              :event="event"
              :close="requestClose"
            />
          </template>
        </UPopover>
      </div>
    </UContextMenu>
  </div>
</template>
