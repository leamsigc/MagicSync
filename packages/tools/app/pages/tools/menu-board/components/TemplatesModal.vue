<script setup lang="ts">
/**
 *
 * TemplatesModal — pick a pre-built signage template for a new page.
 *
 */
import { MENU_TEMPLATES } from '../templates'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [templateId: string] }>()

function pick(id: string): void {
  emit('select', id)
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-3xl' }">
    <template #content>
      <div class="p-6" data-testid="templates-modal">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold tracking-tight">Choose a Template</h2>
          <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { open = false }" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto pr-1">
          <button
v-for="template in MENU_TEMPLATES" :key="template.id"
            class="border-2 border-border rounded-xl p-4 text-left cursor-pointer hover:border-primary hover:shadow-md transition-all group"
            :data-testid="`template-card-${template.id}`" @click="pick(template.id)">
            <div
              class="aspect-video bg-muted rounded-lg mb-3 overflow-hidden relative border border-border pointer-events-none">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
class="absolute inset-0 origin-top-left scale-[0.25] w-[400%] h-[400%]"
                v-html="template.content" />
            </div>
            <h3 class="font-semibold text-foreground">{{ template.name }}</h3>
            <p class="text-sm text-muted-foreground">Click to use this template</p>
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>
