<script setup lang="ts">
/**
 *
 * Component Description: The red line marking the current time in a timed grid.
 *
 * Positioned from the minutes past local midnight, updated once a minute. Kept
 * client-only by its caller: `useNow` has nothing meaningful to render on the
 * server and would only cost a hydration mismatch.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { PX_PER_MINUTE } from '../../utils/calendarLayout'
import { minutesIntoDay } from '../../utils/calendarDates'

const now = useNow({ interval: 60_000 })

const top = computed(() => minutesIntoDay(now.value) * PX_PER_MINUTE)
</script>

<template>
  <div
    class="absolute inset-x-0 z-10 border-t-2 border-error pointer-events-none"
    :style="{ top: `${top}px` }"
  >
    <div class="absolute -top-[5px] -start-1 size-2 rounded-full bg-error" />
  </div>
</template>
