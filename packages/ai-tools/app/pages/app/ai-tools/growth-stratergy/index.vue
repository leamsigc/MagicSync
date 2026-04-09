<i18n src="./index.json"></i18n>
<script lang="ts" setup>
import type { EditorToolbarItem, EditorSuggestionMenuItem } from '@nuxt/ui'


/**
 *
 * Component Description: Dashboard for social media growth strategy, featuring action plans and principles.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const items: EditorToolbarItem[] = [
  { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold' },
  { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic' },
  { kind: 'heading', level: 1, icon: 'i-lucide-heading-1' },
  { kind: 'heading', level: 2, icon: 'i-lucide-heading-2' },
  { kind: 'textAlign', align: 'left', icon: 'i-lucide-align-left' },
  { kind: 'textAlign', align: 'center', icon: 'i-lucide-align-center' },
  { kind: 'bulletList', icon: 'i-lucide-list' },
  { kind: 'orderedList', icon: 'i-lucide-list-ordered' },
  { kind: 'blockquote', icon: 'i-lucide-quote' },
  { kind: 'link', icon: 'i-lucide-link' }
]
const itemSuggestions: EditorSuggestionMenuItem[][] = [
  [
    {
      type: 'label',
      label: 'Text'
    },
    {
      kind: 'paragraph',
      label: 'Paragraph',
      icon: 'i-lucide-type'
    },
    {
      kind: 'heading',
      level: 1,
      label: 'Heading 1',
      icon: 'i-lucide-heading-1'
    },
    {
      kind: 'heading',
      level: 2,
      label: 'Heading 2',
      icon: 'i-lucide-heading-2'
    },
    {
      kind: 'heading',
      level: 3,
      label: 'Heading 3',
      icon: 'i-lucide-heading-3'
    }
  ],
  [
    {
      type: 'label',
      label: 'Lists'
    },
    {
      kind: 'bulletList',
      label: 'Bullet List',
      icon: 'i-lucide-list'
    },
    {
      kind: 'orderedList',
      label: 'Numbered List',
      icon: 'i-lucide-list-ordered'
    }
  ],
  [
    {
      type: 'label',
      label: 'Insert'
    },
    {
      kind: 'blockquote',
      label: 'Blockquote',
      icon: 'i-lucide-text-quote'
    },
    {
      kind: 'codeBlock',
      label: 'Code Block',
      icon: 'i-lucide-square-code'
    },
    {
      kind: 'horizontalRule',
      label: 'Divider',
      icon: 'i-lucide-separator-horizontal'
    }
  ]
]
definePageMeta({ layout: 'ai-tools-layout' })

const { t } = useI18n()
const { actionPlan, editingSection, editBuffer, startEditing, saveEditing, cancelEditing, resetSection } = useGrowthStrategy()

const activeTab = ref(0)

const nextStepsMd = computed(() => t('defaults.nextStepsMd', {
  nextSteps: t('tabs.nextSteps')
}))

const principlesMd = computed(() => t('defaults.principlesMd', {
  principles: t('tabs.principles')
}))

const tabs = computed(() => [
  { label: t('tabs.nextSteps'), active: true, slot: 'next-steps' as const, icon: 'i-lucide-target', },
  { label: t('tabs.principles'), slot: 'principles' as const, icon: 'i-lucide-flame' },
  { label: t('tabs.actionPlan'), slot: 'action-plan' as const, icon: 'i-lucide-calendar' },
])

const actionSections = computed(() => [
  { id: 'day7', label: t('actionPlan.day7'), icon: 'i-lucide-zap' },
  { id: 'day30', label: t('actionPlan.day30'), icon: 'i-lucide-calendar-days' },
  { id: 'day90', label: t('actionPlan.day90'), icon: 'i-lucide-trophy' },
] as const)

const appendToBody = import.meta.client ? () => document.body : undefined
</script>

<template>
  <div class="space-y-8">
    <BasePageHeader :title="t('title')" :description="t('subtitle')">
      <template #actions>
        <UButton to="/app/ai-tools/growth-stratergy/create" icon="i-lucide-rocket" color="primary" size="lg"
          class="rounded-full px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
          {{ t('cta') }}
        </UButton>
      </template>
    </BasePageHeader>

    <div class="mx-auto">
      <UTabs variant="link" :items="tabs" class="w-full">
        <template #next-steps>
          <UCard class=" overflow-hidden border-0 rounded-none bg-transparent shadow-none ring-0">
            <div
              class="p-8 prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-primary prose-a:text-primary hover:prose-a:underline">
              <Comark :markdown="nextStepsMd" content-type="markdown" />
            </div>
          </UCard>
        </template>
        <template #principles>
          <UCard class=" overflow-hidden rounded-none bg-transparent shadow-none ring-0">
            <div
              class="p-8 prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-primary prose-a:text-primary hover:prose-a:underline">
              <Comark :markdown="principlesMd" content-type="markdown" />
            </div>
          </UCard>
        </template>
        <template #action-plan>
          <div class="grid grid-cols-1 gap-6">
            <UCard v-for="section in actionSections" :key="section.id"
              class="group relative bg-transparent transition-all duration-300 overflow-hidden ring-0 ">
              <div class="p-8">
                <div class="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
                  <div class="flex items-center gap-4">
                    <div
                      class="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                      <UIcon :name="section.icon" class="w-6 h-6" />
                    </div>
                    <h3 class="text-xl font-bold tracking-tight">{{ section.label }}</h3>
                  </div>
                  <div class="flex gap-2">
                    <template v-if="editingSection === section.id">
                      <UButton color="primary" variant="soft" icon="i-lucide-check" class="rounded-xl"
                        @click="saveEditing">
                        {{ t('actionPlan.save') }}
                      </UButton>
                      <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="rounded-xl"
                        @click="cancelEditing">
                        {{ t('actionPlan.cancel') }}
                      </UButton>
                    </template>
                    <template v-else>
                      <UButton color="neutral" variant="ghost" icon="i-lucide-edit-2"
                        class="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="startEditing(section.id)">
                        {{ t('actionPlan.edit') }}
                      </UButton>
                      <UButton color="neutral" variant="ghost" icon="i-lucide-rotate-ccw"
                        class="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="resetSection(section.id)">
                        {{ t('actionPlan.reset') }}
                      </UButton>
                    </template>
                  </div>
                </div>

                <div class="prose prose-neutral dark:prose-invert max-w-none">
                  <template v-if="editingSection === section.id">
                    <UEditor v-slot="{ editor }" v-model="editBuffer" content-type="markdown" variant="none"
                      class="w-full bg-muted/30 rounded-2xl p-4 font-mono text-sm border-2 border-primary/20 focus:border-primary transition-colors">
                      <UEditorToolbar :editor="editor" :items="items" layout="bubble" />
                      <UEditorSuggestionMenu :editor="editor" :items="itemSuggestions" :append-to="appendToBody" />
                    </UEditor>
                  </template>
                  <Comark v-else :markdown="actionPlan[section.id]" content-type="markdown" />
                </div>
              </div>
            </UCard>
          </div>
        </template>
      </UTabs>
    </div>
  </div>
</template>

<style scoped>
.prose :deep(h2) {
  margin-top: 0;
}
</style>
