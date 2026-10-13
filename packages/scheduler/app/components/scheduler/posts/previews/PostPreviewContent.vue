<!--  Translation file -->
<i18n src="./PostPreviewContent.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: the caption body of a platform preview.
 *
 * Generalises the tokenizer that lived inline in `VerticalVideoPreview.vue`
 * (lines 17-24) — which only split on whitespace and only recognised `#` and
 * `http` — into a matcher table plus a single regex split, so links, hashtags,
 * mentions and emails all come out of one pass instead of four ad-hoc checks.
 *
 * The platform decides what is a link. `supportsLinkPreviews` is the config
 * gate: on a platform without link previews (Instagram, TikTok, dribbble) a
 * URL is plain caption text, exactly as it renders on that network. Hashtags
 * follow `supportsTags`, and mentions and emails are always highlighted —
 * nothing in the config disables them.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PlatformConfig } from '#layers/BaseShared/shared/platformConstants'
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants'

const props = defineProps<{
  /** The caption to render, already resolved for this platform. */
  content: string
  /** Platform key, whose config decides which token kinds are live. */
  platform: string
}>()

const { t } = useI18n()

type TokenKind = 'text' | 'link' | 'hashtag' | 'mention' | 'email'

interface ContentToken {
  text: string
  kind: TokenKind
}

/** Splits a caption on whole tokens; the capture group keeps the text intact. */
const SPLIT_PATTERN = /(https?:\/\/\S+|[^\s@]+@[^\s@]+\.[^\s@]+|[#@][^\s]+)/

/** Ordered matcher table. First hit wins, so there is no branch tree to re-read. */
const TOKEN_MATCHERS: Array<{ kind: TokenKind; pattern: RegExp }> = [
  { kind: 'link', pattern: /^https?:\/\/\S+$/ },
  { kind: 'email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  { kind: 'hashtag', pattern: /^#\S+$/ },
  { kind: 'mention', pattern: /^@\S+$/ },
]

/** Which token kinds the platform actually renders as interactive. */
const TOKEN_ENABLED: Record<Exclude<TokenKind, 'text'>, (config: PlatformConfig) => boolean> = {
  link: (config) => config.supportsLinkPreviews,
  email: () => true,
  hashtag: (config) => config.supportsTags !== false,
  mention: () => true,
}

/** Token kind → classes, so the template never branches on the kind. */
const TOKEN_CLASSES: Record<TokenKind, string> = {
  text: '',
  link: 'break-all text-primary underline underline-offset-2',
  email: 'break-all text-primary',
  hashtag: 'font-medium text-primary',
  mention: 'font-medium text-primary',
}

function classifyToken(part: string): TokenKind {
  const matcher = TOKEN_MATCHERS.find((entry) => entry.pattern.test(part))

  return matcher?.kind ?? 'text'
}

const config = computed<PlatformConfig>(() => {
  return platformConfigurations[props.platform] ?? platformConfigurations.default
})

const tokens = computed<ContentToken[]>(() => {
  const platformConfig = config.value

  return props.content.split(SPLIT_PATTERN).map((part) => {
    const kind = classifyToken(part)
    const rendered = kind === 'text' || TOKEN_ENABLED[kind](platformConfig) ? kind : 'text'

    return { text: part, kind: rendered }
  })
})
</script>

<template>
  <p
    v-if="content"
    class="mt-3 whitespace-break-spaces text-sm text-highlighted"
    :aria-label="t('bodyLabel')"
  >
    <component
      :is="token.kind === 'link' ? 'a' : 'span'"
      v-for="(token, index) in tokens"
      :key="index"
      :href="token.kind === 'link' ? token.text : undefined"
      :target="token.kind === 'link' ? '_blank' : undefined"
      :rel="token.kind === 'link' ? 'noopener noreferrer' : undefined"
      :aria-label="token.kind === 'link' ? t('externalLink') : undefined"
      :class="TOKEN_CLASSES[token.kind]"
    >{{ token.text }}</component>
  </p>
</template>
