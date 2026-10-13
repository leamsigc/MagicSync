/**
 * Pointer-capture drag to move an event block to another day and time.
 *
 * Move-only: a post has a single `scheduledAt` and no duration to persist, so
 * there is no resize branch and no end is ever committed. The block itself is
 * translated as a ghost preview; the real update happens on drop.
 *
 * The day columns are measured once per drag and are the geometry source, so a
 * drag can run from one day into the next while the wall clock of the source
 * survives the DST boundary.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import { addDays, DRAG_THRESHOLD, minutesFromOffset } from '../utils/calendarLayout'
import { parseLocalDatetime, snapMinutes } from '../utils/calendarDates'

export interface UseCalendarEventDragOptions {
  /** Called with the dropped start once the pointer lifts. */
  onCommit: (start: Date) => void
}

/** The column index a client x sits inside, or `-1` outside the grid. */
function pickColumn(rects: DOMRect[], clientX: number): number {
  return rects.findIndex(rect => clientX >= rect.left && clientX < rect.right)
}

/** The whole number of days a client x is from the column the drag started in. */
function stepFor(rects: DOMRect[], clientX: number, origin: number): number {
  const target = pickColumn(rects, clientX)

  return target === -1 || origin === -1 ? 0 : target - origin
}

export function useCalendarEventDrag(
  event: MaybeRefOrGetter<CalendarEvent>,
  options: UseCalendarEventDragOptions
) {
  const dragging = ref(false)
  // Keeps the popover from opening on the click that ends a drag
  const suppressed = ref(false)
  const deltaMinutes = ref(0)
  const deltaDays = ref(0)

  let active = false
  let startX = 0
  let startY = 0
  let columnRects: DOMRect[] = []
  let columnIndex = -1

  function reset() {
    active = false
    dragging.value = false
    deltaMinutes.value = 0
    deltaDays.value = 0
  }

  function onPointerdown(pointerEvent: PointerEvent) {
    if (pointerEvent.button !== 0) {
      return
    }

    const target = pointerEvent.currentTarget as HTMLElement

    startX = pointerEvent.clientX
    startY = pointerEvent.clientY

    // Measure the day columns once per drag, they are the geometry source
    const grid = target.closest('[data-week-grid]')
    columnRects = grid
      ? [...grid.querySelectorAll('[data-day-column]')].map(column => column.getBoundingClientRect())
      : []
    columnIndex = pickColumn(columnRects, pointerEvent.clientX)

    target.setPointerCapture(pointerEvent.pointerId)
    active = true
  }

  function onPointermove(pointerEvent: PointerEvent) {
    if (!active) {
      return
    }

    const dx = pointerEvent.clientX - startX
    const dy = pointerEvent.clientY - startY

    if (!dragging.value) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return
      }

      dragging.value = true
      suppressed.value = true
    }

    deltaMinutes.value = snapMinutes(minutesFromOffset(dy))
    deltaDays.value = stepFor(columnRects, pointerEvent.clientX, columnIndex)
  }

  // Let the trailing click event pass before re-enabling the popover
  function release() {
    setTimeout(() => {
      suppressed.value = false
    })
  }

  function onPointerup() {
    if (active) {
      const moved = deltaMinutes.value !== 0 || deltaDays.value !== 0

      if (dragging.value && moved) {
        const source = parseLocalDatetime(toValue(event).start)

        // `addDays` for the column step so the wall clock survives DST; only
        // the vertical part of the drag is real minutes
        const start = addDays(source, deltaDays.value)
        start.setMinutes(start.getMinutes() + deltaMinutes.value)

        options.onCommit(start)
      }

      reset()
    }

    // Runs even after an Escape cancel dropped `active`, it is what clears the
    // suppression once the pointer really lifts
    release()
  }

  function onPointercancel() {
    reset()
    release()
  }

  useEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
    // Cancels the drag but keeps the popover suppressed: the pointer is still
    // down and the click its release fires should not open it
    if (keyboardEvent.key === 'Escape' && dragging.value) {
      reset()
    }
  })

  // A gesture can end without a pointer event: releasing the mouse outside the
  // window after switching apps fires neither pointerup nor pointercancel,
  // which would leave the popover suppressed for good
  useEventListener('blur', () => {
    if (active || suppressed.value) {
      reset()
      release()
    }
  })

  return {
    dragging,
    suppressed,
    deltaMinutes,
    deltaDays,
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel
  }
}
