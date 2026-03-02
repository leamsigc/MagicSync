<i18n src="./index.json"></i18n>
<script lang="ts" setup>
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

    <div class="max-w-5xl mx-auto">
      <UTabs variant="link" :items="tabs" class="w-full" :ui="{
        list: {
          base: 'relative w-full flex items-center justify-center gap-8 border-b border-border mb-8',
          marker: 'absolute -bottom-px h-[2px] bg-primary transition-all duration-300',
          tab: {
            base: 'px-4 py-3 text-sm font-medium transition-colors duration-200 focus:outline-none',
            active: 'text-primary',
            inactive: 'text-muted-foreground hover:text-foreground'
          }
        }
      }">
        <template #next-steps>
          <UCard class="bg-background/50 backdrop-blur-xl border-border shadow-sm rounded-3xl overflow-hidden">
            <div
              class="p-8 prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-primary prose-a:text-primary hover:prose-a:underline">
              <UEditor v-model="nextStepsMd" content-type="markdown" />
            </div>
          </UCard>
        </template>
        <template #principles>
          <UCard class="bg-background/50 backdrop-blur-xl border-border shadow-sm rounded-3xl overflow-hidden">
            <div
              class="p-8 prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-primary prose-a:text-primary hover:prose-a:underline">
              <UEditor v-model="principlesMd" content-type="markdown" />
            </div>
          </UCard>
        </template>
        <template #action-plan>
          <div class="grid grid-cols-1 gap-6">
            <UCard v-for="section in actionSections" :key="section.id"
              class="group relative bg-background/50 backdrop-blur-xl border-border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-3xl overflow-hidden">
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
                    <UTextarea v-model="editBuffer" autoresize :rows="12" variant="none"
                      class="w-full bg-muted/30 rounded-2xl p-4 font-mono text-sm border-2 border-primary/20 focus:border-primary transition-colors" />
                  </template>
                  <UEditor v-else v-model="actionPlan[section.id]" content-type="markdown" />
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
