<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio'
import StudioColorField from './StudioColorField.vue'

/**
 * Studio tab — title, save, publish, version history, brand kits, and the
 * "My Designs" browser that replaces the old hardcoded template list.
 */

const { t } = useI18n()
const { editor } = useFabricJs()
const studio = useDesignStudio()

const saving = computed(() => studio.busy.value === 'save')
const loading = computed(() => studio.busy.value === 'open' || studio.busy.value === 'designs')
const titleValue = computed(() => studio.currentTitle.value)
const deleteOpen = ref(false)
const pendingDelete = ref<{ id: string; title: string } | null>(null)

function openDesign(id: string): void {
  void studio.openDesign(id)
}

function designThumbnail(design: { thumbnails?: Array<{ url: string }> }): string | null {
  return design.thumbnails?.[0]?.url ?? null
}

function formatDesignDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleDeleteDesign(design: { id: string; title: string }): void {
  pendingDelete.value = design
  deleteOpen.value = true
}

function closeDelete(): void {
  deleteOpen.value = false
  pendingDelete.value = null
}

async function confirmDeleteDesign(): Promise<void> {
  if (!pendingDelete.value) return
  await studio.removeDesign(pendingDelete.value.id)
  pendingDelete.value = null
  deleteOpen.value = false
}

const watermarkText = ref('')
const watermarkBusy = ref(false)

async function addWatermark(): Promise<void> {
  const text = watermarkText.value.trim()
  if (!text) {
    useToast().add({ title: t('studio.design.watermarkEmpty'), color: 'warning', icon: 'i-lucide-type' })
    return
  }
  watermarkBusy.value = true
  const plugin = editor.value?.getPlugin?.('watermark') as { addWatermark?: (value: string) => boolean } | undefined
  const ok = plugin?.addWatermark?.(text) ?? false
  watermarkBusy.value = false
  useToast().add({
    title: ok ? t('studio.design.watermarkAdded') : t('studio.design.watermarkFailed'),
    color: ok ? 'success' : 'error',
    icon: 'i-lucide-droplets',
  })
}

function removeWatermark(): void {
  const plugin = editor.value?.getPlugin?.('watermark') as { removeWatermark?: () => void } | undefined
  plugin?.removeWatermark?.()
  useToast().add({ title: t('studio.design.watermarkRemoved'), color: 'neutral', icon: 'i-lucide-eraser' })
}

const newKitName = ref('')
const kitColors = ref<Array<{ name: string; hex: string }>>([
  { name: 'Primary', hex: '#c2410c' },
  { name: 'Ink', hex: '#111827' },
  { name: 'Paper', hex: '#fdf6ec' },
])
const kitHeading = ref('')
const kitBody = ref('')

const fontOptions = [
  'Archivo Black', 'Anton', 'Bebas Neue', 'Lobster', 'Pacifico', 'Abril Fatface', 'Righteous', 'Alfa Slab One', 'DejaVu Sans', 'Noto Sans SC', 'Ma Shan Zheng', 'ZCOOL KuaiLe', 'ZCOOL QingKe HuangYou',
].map(family => ({ label: family, value: family }))

function goLogin(): void {
  void navigateTo('/login')
}

async function handleSave(): Promise<void> {
  if (studio.requiresAuth.value) {
    goLogin()
    return
  }
  await studio.saveDesign()
}

async function handleSaveAsNew(): Promise<void> {
  await studio.saveDesign({ asNew: true })
}

function handleTitleChange(event: string): void {
  studio.setTitle(event)
}

async function handleTogglePublish(design: { id: string; isPublic: boolean }): Promise<void> {
  await studio.publishDesign(design.id, !design.isPublic)
}

async function handleRestore(versionId: string): Promise<void> {
  await studio.restoreVersion(versionId)
}

async function handleCreateKit(): Promise<void> {
  const name = newKitName.value.trim()
  if (!name) {
    useToast().add({ title: t('studio.design.kitNameNeeded'), color: 'warning', icon: 'i-lucide-alert-triangle' })
    return
  }
  await studio.createBrandKit(name, kitColors.value, { heading: kitHeading.value, body: kitBody.value })
  newKitName.value = ''
}

async function handleApplyKit(kit: { id: string; colors: Array<{ name: string; hex: string }>; fonts: { heading?: string; body?: string }; logoUrl?: string }): Promise<void> {
  const canvas = editor.value?.fabricCanvas
  const plugin = editor.value?.getPlugin?.('core') as { setWorkspaceBg?: (color: string) => void } | undefined
  if (canvas && plugin?.setWorkspaceBg && kit.colors[0]?.hex) plugin.setWorkspaceBg(kit.colors[0].hex)
  const texts = canvas?.getObjects().filter(obj => (obj as { type?: string }).type === 'textbox') ?? []
  const [first, ...rest] = texts
  for (const obj of texts) {
    const family = obj === first ? kit.fonts.heading : kit.fonts.body
    if (family) obj.set('fontFamily', family)
  }
  canvas?.requestRenderAll()
  useToast().add({ title: t('studio.design.kitApplied'), description: kit.name, color: 'success', icon: 'i-lucide-swatch-book' })
}

onMounted(() => {
  void studio.fetchDesigns('', 0)
  void studio.fetchBrandKits()
})
</script>

<template>
  <div class="space-y-5">
    <UAlert
      v-if="studio.requiresAuth.value"
      color="warning" variant="soft" icon="i-lucide-lock"
      :title="t('studio.auth.title')" :description="t('studio.auth.desc')">
      <template #actions>
        <UButton size="xs" color="primary" @click="goLogin">{{ t('studio.auth.action') }}</UButton>
      </template>
    </UAlert>

    <!-- save box -->
    <section class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2.5">
      <UFormField :label="t('studio.design.title')" size="xs">
        <UInput
          :model-value="titleValue" size="xs" class="w-full"
          :placeholder="t('studio.design.titlePlaceholder')"
          @update:model-value="handleTitleChange" />
      </UFormField>
      <div class="flex gap-2">
        <UButton size="xs" color="primary" variant="solid" icon="lucide:save" class="flex-1 whitespace-nowrap" :loading="saving" :disabled="studio.requiresAuth.value" @click="handleSave">
          {{ t('studio.design.save') }}
        </UButton>
        <UButton size="xs" color="neutral" variant="soft" icon="lucide:copy-plus" class="flex-1 whitespace-nowrap" :loading="saving" :disabled="studio.requiresAuth.value" @click="handleSaveAsNew">
          {{ t('studio.design.saveAsNew') }}
        </UButton>
      </div>
      <div v-if="studio.currentId.value" class="text-[11px] text-muted flex items-center gap-1.5">
        <Icon name="lucide:badge-check" class="w-3.5 h-3.5" />
        {{ t('studio.design.savedAs', { title: studio.currentTitle.value }) }}
        <UButton
          v-if="studio.currentId.value"
          size="xs" variant="ghost"
          :icon="studio.designs.value.find(d => d.id === studio.currentId.value)?.isPublic ? 'lucide:eye-off' : 'lucide:globe'"
          :aria-label="t('studio.design.publish')"
          @click="handleTogglePublish({ id: studio.currentId.value ?? '', isPublic: studio.designs.value.find(d => d.id === studio.currentId.value)?.isPublic ?? false })" />
      </div>
      <div v-else class="text-[11px] text-muted">{{ t('studio.design.notSaved') }}</div>
    </section>

    <!-- my designs -->
    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.design.myDesigns') }}</h3>
      <div v-if="loading && studio.designs.value.length === 0" class="space-y-2">
        <USkeleton v-for="index in 3" :key="index" class="h-16 rounded-xl" />
      </div>
      <UAlert
        v-else-if="studio.designs.value.length === 0"
        color="neutral" variant="soft" icon="i-lucide-layout-template"
        :title="t('studio.design.noDesigns')" />
      <div v-else class="space-y-2">
        <div
          v-for="design in studio.designs.value" :key="design.id"
          class="group flex items-center gap-2 rounded-xl border border-default bg-elevated/50 p-2 transition-colors hover:border-primary">
          <button
            type="button"
            class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-default bg-muted"
            :aria-label="design.title"
            @click="openDesign(design.id)">
            <img
              v-if="designThumbnail(design)" :src="designThumbnail(design) ?? ''" alt=""
              class="h-full w-full object-cover" loading="lazy">
            <span v-else class="flex h-full w-full items-center justify-center">
              <Icon name="lucide:layout-template" class="h-5 w-5 text-dimmed" />
            </span>
          </button>
          <div class="min-w-0 flex-1">
            <button type="button" class="block w-full truncate text-left text-xs font-medium" @click="openDesign(design.id)">
              {{ design.title }}
            </button>
            <div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <UBadge size="sm" variant="subtle" :color="design.isPublic ? 'primary' : 'neutral'">
                {{ design.isPublic ? t('studio.design.published') : t('studio.design.privateDesign') }}
              </UBadge>
              <span class="whitespace-nowrap text-[10px] text-muted">{{ formatDesignDate(design.updatedAt) }}</span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
            <UButton
              size="xs" variant="ghost" color="neutral"
              :icon="design.isPublic ? 'lucide:eye-off' : 'lucide:globe'"
              :aria-label="t('studio.design.publish')"
              @click.stop="handleTogglePublish(design)" />
            <UButton
              size="xs" variant="ghost" color="error" icon="lucide:trash-2"
              :aria-label="t('studio.design.delete')"
              @click.stop="handleDeleteDesign(design)" />
          </div>
        </div>
      </div>
      <UButton
        v-if="studio.hasMoreDesigns.value"
        block size="xs" variant="outline" :loading="loading"
        @click="studio.fetchDesigns('', studio.designsPage.value + 1)">
        {{ t('studio.design.more') }}
      </UButton>
    </section>

    <!-- watermark -->
    <section class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.design.watermark') }}</h3>
      <UInput v-model="watermarkText" size="xs" :placeholder="t('studio.design.watermarkPlaceholder')" @keydown.enter="addWatermark" />
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" icon="lucide:droplets" :loading="watermarkBusy" @click="addWatermark">
          {{ t('studio.design.watermarkAdd') }}
        </UButton>
        <UButton size="xs" variant="ghost" color="neutral" icon="lucide:eraser" @click="removeWatermark">
          {{ t('studio.design.watermarkRemove') }}
        </UButton>
      </div>
    </section>

    <!-- versions -->
    <section v-if="studio.currentId.value" class="space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.design.versions') }}</h3>
      <div v-for="version in studio.versions.value.slice(0, 5)" :key="version.id"
        class="flex items-center gap-2 rounded-lg border border-default bg-elevated/50 px-2.5 py-1.5">
        <div class="flex-1 min-w-0">
          <div class="text-xs truncate">#{{ version.version }} {{ version.title }}</div>
          <div class="text-[10px] text-muted">{{ new Date(version.createdAt).toLocaleString() }}</div>
        </div>
        <UButton size="xs" variant="ghost" icon="lucide:history" :aria-label="t('studio.design.restore')" @click="handleRestore(version.id)" />
      </div>
      <UAlert v-if="studio.versions.value.length === 0" color="neutral" variant="soft" icon="i-lucide-history" :title="t('studio.design.noVersions')" />
    </section>

    <!-- brand kits -->
    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.design.kits') }}</h3>
      <div v-for="kit in studio.brandKits.value" :key="kit.id" class="rounded-xl border border-default bg-elevated/50 p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs font-medium truncate">{{ kit.name }}</div>
          <div class="flex gap-1">
            <UButton size="xs" variant="ghost" icon="lucide:paintbrush" :aria-label="t('studio.design.applyKit')" @click="handleApplyKit(kit)" />
            <UButton size="xs" variant="ghost" color="error" icon="lucide:trash-2" :aria-label="t('studio.design.delete')" @click="studio.deleteBrandKit(kit.id)" />
          </div>
        </div>
        <div class="flex gap-1">
          <span
            v-for="color in kit.colors" :key="color.hex"
            class="w-5 h-5 rounded-md border border-default"
            :style="{ backgroundColor: color.hex }" :title="color.name" />
        </div>
        <div v-if="kit.fonts.heading || kit.fonts.body" class="text-[11px] text-muted">
          {{ kit.fonts.heading }} / {{ kit.fonts.body }}
        </div>
      </div>

      <div class="rounded-xl border border-dashed border-default p-2.5 space-y-2">
        <UInput v-model="newKitName" size="xs" :placeholder="t('studio.design.kitName')" @keydown.enter="handleCreateKit" />
        <div class="flex gap-1">
          <StudioColorField v-model="kitColors[0].hex" variant="swatch" />
          <StudioColorField v-model="kitColors[1].hex" variant="swatch" />
          <StudioColorField v-model="kitColors[2].hex" variant="swatch" />
        </div>
        <div class="flex gap-1.5">
          <USelect v-model="kitHeading" :items="fontOptions" size="xs" :placeholder="t('studio.design.kitHeading')" />
          <USelect v-model="kitBody" :items="fontOptions" size="xs" :placeholder="t('studio.design.kitBody')" />
        </div>
        <UButton block size="xs" variant="soft" icon="lucide:plus" @click="handleCreateKit">
          {{ t('studio.design.kitCreate') }}
        </UButton>
      </div>
    </section>

    <UModal v-model:open="deleteOpen" :title="t('studio.design.deleteTitle')">
      <template #content>
        <div class="space-y-4 p-5">
          <p class="text-sm text-muted">{{ t('studio.design.deleteConfirm', { title: pendingDelete?.title ?? '' }) }}</p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="closeDelete">{{ t('studio.design.cancel') }}</UButton>
            <UButton color="error" icon="lucide:trash-2" @click="confirmDeleteDesign">{{ t('studio.design.delete') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
