<!--  Translation file -->
<i18n src="./PostPreviewComments.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: the comment thread of a platform preview.
 *
 * Renders the comment texts a row actually carries, cropped to the platform's
 * `spec.maxComments`, plus the composer placeholder every platform shows under
 * its thread. Commenters have no identity anywhere in the schema — `posts` and
 * `platformPosts` carry no author for a comment — so the thread is text rows
 * with no avatars and no per-comment counts, and it never runs for a post that
 * has not published (the shell gates it on `spec.showsComments && published`).
 *
 * The placeholder text is passed in already translated, so each platform keeps
 * its own voice ("Toot your reply", "Add a comment…") in its own locale file.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
const props = defineProps<{
  /** Real comment texts on the row, platform override first. */
  comments: string[]
  /** Cap from `spec.maxComments`; extras collapse into the "more" line. */
  maxComments: number
  /** Already-translated heading rendered above the thread, if the platform has one. */
  heading?: string
  /** Already-translated composer placeholder. */
  placeholder?: string
}>()

const { t } = useI18n()

const visibleComments = computed(() => props.comments.slice(0, props.maxComments))

const hiddenCount = computed(() => props.comments.length - visibleComments.value.length)
</script>

<template>
  <div class="mt-3 space-y-2 border-t border-default pt-3">
    <p v-if="heading" class="text-xs font-semibold text-muted">{{ heading }}</p>

    <div v-if="visibleComments.length" class="space-y-2">
      <p v-for="(comment, index) in visibleComments" :key="index" class="text-sm text-highlighted">
        {{ comment }}
      </p>
      <p v-if="hiddenCount > 0" class="text-xs text-dimmed">
        {{ t('moreComments', { count: hiddenCount }) }}
      </p>
    </div>

    <div v-if="placeholder" class="flex items-center gap-2 rounded-lg bg-accented px-3 py-2">
      <Icon
        name="i-heroicons-chat-bubble-oval-left-ellipsis"
        class="size-4 shrink-0 text-dimmed"
        aria-hidden="true"
      />
      <span class="text-xs text-dimmed">{{ placeholder }}</span>
    </div>
  </div>
</template>
