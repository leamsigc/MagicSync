<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { editorComarkPlugins } from '~/plugins/comark-plugins'

/**
 * The article, rendered. comark is the preview renderer for markdown in this
 * product and always is (PRD-CONTENT-PIPELINE-OVERHAUL §1.2): `@comark/nuxt`
 * registers `<Markdown>`, which parses on the client and renders through the
 * component manifest — `<Markdown :value="…" :plugins="…" />`.
 */

const props = defineProps<{ markdown: string }>()

const { t } = useI18n()
const plugins = editorComarkPlugins()
</script>

<template>
  <div class="prose prose-neutral max-w-none text-highlighted dark:prose-invert" data-testid="article-preview">
    <Markdown v-if="props.markdown" :value="props.markdown" :plugins="plugins" />
    <p v-else class="text-sm text-muted">
      {{ t('draft.empty') }}
    </p>
  </div>
</template>