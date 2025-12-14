<script lang="ts" setup>
import { useI18n } from '#imports'

/**
 *
 * The translation trigger and menu component
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { en, es, fr, de, } from '@nuxt/ui/locale'
const { locale, setLocale } = useI18n()

</script>

<template>
  <ULocaleSelect v-model="locale" :locales="[en, es, fr, de]" @update:model-value="setLocale($event as any)"
    class="max-w-8 md:max-w-28" variant="none" />
</template>
<style scoped></style>
