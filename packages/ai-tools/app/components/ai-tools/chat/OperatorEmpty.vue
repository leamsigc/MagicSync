<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div v-motion-fade :duration="250" class="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 text-center">
    <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
      <UIcon name="i-heroicons-sparkles" class="size-6 text-primary" />
    </div>
    <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
      {{ t('operator.emptyTitle') }}
    </h1>
    <p class="max-w-md text-sm leading-6 text-muted sm:text-base">
      {{ t('operator.emptyLine') }}
    </p>
  </div>
</template>
