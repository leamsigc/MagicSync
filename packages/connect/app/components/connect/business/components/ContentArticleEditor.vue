<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'

/**
 * The edit surface for the article — the Nuxt UI editor in markdown mode, the
 * same control the owner already had. The artifact stays markdown: this edits
 * the stored string, and comark renders it again on the way back to preview.
 *
 * `insertImage` is the one thing a parent cannot do from the markdown string
 * alone: the caret lives in ProseMirror, so the image node is inserted through
 * the editor's own command and lands where the owner was typing (PRD §10 D09).
 */

/** The slice of the tiptap instance the image insertion needs — no tiptap import. */
interface ImageCommand {
  focus: () => ImageCommand
  setImage: (attrs: { src: string, alt: string }) => ImageCommand
  run: () => boolean
}

interface EditorHost {
  editor?: { chain: () => ImageCommand }
}

const model = defineModel<string>({ default: '' })

defineProps<{ disabled: boolean }>()

const TOOLBAR: EditorToolbarItem[] = [
  { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold' },
  { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic' },
  { kind: 'heading', level: 2, icon: 'i-lucide-heading-2' },
  { kind: 'heading', level: 3, icon: 'i-lucide-heading-3' },
  { kind: 'bulletList', icon: 'i-lucide-list' },
  { kind: 'orderedList', icon: 'i-lucide-list-ordered' },
  { kind: 'blockquote', icon: 'i-lucide-quote' },
  { kind: 'link', icon: 'i-lucide-link' },
]

let host: EditorHost | null = null

function captureEditor(instance: unknown) {
  const editor = (instance as EditorHost | null)?.editor
  host = editor ? (instance as EditorHost) : null
}

/** Insert at the caret; the v-model round-trips through the markdown serializer. */
function insertImage(src: string, alt: string) {
  host?.editor?.chain().focus().setImage({ src, alt }).run()
}

defineExpose({ insertImage })
</script>

<template>
  <UEditor
    v-slot="{ editor: tiptap }"
    v-model="model"
    content-type="markdown"
    class="w-full"
    :disabled="disabled"
    :ref="captureEditor"
    data-testid="article-editor"
  >
    <UEditorToolbar :editor="tiptap" :items="TOOLBAR" />
  </UEditor>
</template>