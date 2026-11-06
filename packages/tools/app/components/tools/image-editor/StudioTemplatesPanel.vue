<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio'

/**
 * Templates tab — the public template library (free, {prefix:price unused})
 * plus JSON import through /api/v1/image-editor/import (v5/v7 → v7 normal).
 */

interface DesignLike {
  id: string
  title: string
  isPublic: boolean
  pages?: number
  fields?: string[]
  thumbnails?: Array<{ name: string; url: string }>
}

const { t } = useI18n()
const { editor } = useFabricJs()
const studio = useDesignStudio()

const templates = computed(() => [...studio.templates.value])
const importing = ref(false)
const loadingId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement>()

function thumbnailUrl(design: DesignLike): string | null {
  const first = design.thumbnails?.find(entry => typeof entry.url === 'string' && entry.url.length > 24)
  return first?.url ?? null
}

async function refresh(): Promise<void> {
  await studio.fetchTemplates('')
}

async function openTemplate(id: string): Promise<void> {
  loadingId.value = id
  const opened = await studio.openTemplate(id)
  loadingId.value = null
  if (opened && !studio.requiresAuth.value) {
    useToast().add({ title: t('studio.templates.opened'), color: 'success', icon: 'i-lucide-check' })
  }
}

async function importJsonFile(event: Event): Promise<void> {
  const files = (event.target as HTMLInputElement).files
  const file = files?.[0]
  if (!file) return
  importing.value = true
  try {
    const templateJson = await file.text()
    const created = await $fetch<{ id: string; warnings: string[] }>('/api/v1/image-editor/import', {
      method: 'POST',
      body: { template: templateJson },
    })
    await studio.openDesign(created.id)
    await refresh()
    useToast().add({ title: t('studio.templates.imported'), color: 'success', icon: 'i-lucide-file-json' })
  } catch {
    useToast().add({ title: t('studio.templates.importFailed'), color: 'error', icon: 'i-lucide-x-circle' })
  }
  importing.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function goLogin(): void {
  void navigateTo('/login')
}

function pickFile(): void {
  fileInput.value?.click()
}

onMounted(refresh)
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="studio.requiresAuth.value"
      color="warning" variant="soft" icon="i-lucide-lock"
      :title="t('studio.auth.title')" :description="t('studio.auth.desc')">
      <template #actions>
        <UButton size="xs" color="primary" @click="goLogin">{{ t('studio.auth.action') }}</UButton>
      </template>
    </UAlert>

    <section class="space-y-2">
      <UButton block icon="lucide:upload" variant="outline" :loading="importing" @click="pickFile">
        {{ t('studio.templates.import') }}
      </UButton>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importJsonFile">
      <div class="text-xs text-center text-muted">
        {{ t('studio.templates.importHint') }}
      </div>
    </section>

    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.templates.library') }}</h3>
        <UButton size="xs" variant="ghost" icon="lucide:refresh-ccw" :aria-label="t('common.refresh')" @click="refresh" />
      </div>

      <div
        v-for="template in templates" :key="template.id"
        class="border border-default rounded-xl p-2 hover:border-primary cursor-pointer transition-colors bg-elevated/50"
        @click="openTemplate(template.id)">
        <div class="aspect-3/4 rounded-lg mb-2 flex items-center justify-center overflow-hidden bg-muted">
          <img v-if="thumbnailUrl(template)" :src="thumbnailUrl(template) ?? ''" class="w-full h-full object-contain" alt="" loading="lazy">
          <Icon v-else name="lucide:layout-template" class="w-8 h-8 text-dimmed" />
        </div>
        <div class="text-xs font-medium truncate">{{ template.title }}</div>
        <div class="text-[11px] text-muted">
          {{ t('studio.templates.meta', { pages: template.pages ?? 1, fields: template.fields?.length ?? 0 }) }}
        </div>
      </div>

      <UAlert v-if="templates.length === 0" color="neutral" variant="soft" icon="i-lucide-layout-template" :title="t('studio.templates.empty')" />
    </section>
  </div>
</template>
