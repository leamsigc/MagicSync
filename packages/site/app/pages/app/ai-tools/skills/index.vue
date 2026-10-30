<i18n src="./skills.json"></i18n>

<script setup lang="ts">
/**
 * Agent skills registry — shared collection shell (Grid / List + search).
 *
 * The skill CRUD/import calls are untouched; only the surface moved to
 * `BaseCollectionPage` + `BaseCollectionToolbar` + `BaseCollectionGrid` /
 * `BaseCollectionList`, so every view reads the same filtered list.
 */
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'

interface Skill {
  id: string
  name: string
  description: string
  instructions: string
  enabled: boolean
  isGlobal: boolean
  createdAt: string
  updatedAt: string
}

type SkillView = 'grid' | 'list'
type ImportMode = 'zip' | 'url' | 'folder'
type BadgeTone = 'primary' | 'neutral'

const { t } = useI18n()
const toast = useToast()

const skills = ref<Skill[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showImportModal = ref(false)
const importMode = ref<ImportMode>('zip')
const selectedSkill = ref<Skill | null>(null)

const newSkill = ref({
  name: '',
  description: '',
  instructions: '',
  isGlobal: false,
})

const importData = ref({
  zipFile: null as File | null,
  url: '',
  folderPath: '',
})

const {
  view,
  setView,
  search,
  setSearch,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<Skill>({
  key: 'app-ai-tools-skills',
  modes: ['grid', 'list'] satisfies SkillView[],
  defaultView: 'grid',
  rows: skills,
  searchFields: skill => [skill.name, skill.description, skill.instructions],
})

const viewOptions = computed(() => [
  { value: 'grid', label: t('viewGrid'), icon: 'i-lucide-layout-grid' },
  { value: 'list', label: t('viewList'), icon: 'i-lucide-list' },
])

const importModes = computed<Array<{ value: ImportMode, label: string }>>(() => [
  { value: 'zip', label: t('importFromZip') },
  { value: 'url', label: t('importFromUrl') },
  { value: 'folder', label: t('importFromFolder') },
])

function skillRowKey(skill: Skill): string {
  return skill.id
}

function skillState(skill: Skill): string {
  return skill.enabled ? t('enabled') : t('disabled')
}

function skillTone(skill: Skill): BadgeTone {
  return skill.enabled ? 'primary' : 'neutral'
}

function skillToggleLabel(skill: Skill): string {
  return skill.enabled ? t('disable') : t('enable')
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

function handleViewChange(next: SkillView) {
  setView(next)
}

function handleOpenCreate() {
  showCreateModal.value = true
}

function handleCloseCreate() {
  showCreateModal.value = false
}

function handleOpenImport() {
  showImportModal.value = true
}

function handleCloseImport() {
  showImportModal.value = false
}

function handleSelectImportMode(mode: ImportMode) {
  importMode.value = mode
}

function handleOpenEdit(skill: Skill) {
  selectedSkill.value = { ...skill }
  showEditModal.value = true
}

function handleCloseEdit() {
  showEditModal.value = false
}

function handleZipChange(event: Event) {
  const input = event.target as HTMLInputElement
  importData.value.zipFile = input.files?.[0] ?? null
}

async function fetchSkills() {
  loading.value = true
  try {
    const data = await $fetch<Skill[]>('/api/ai-tools/skills')
    skills.value = data || []
  } catch {
    toast.add({ title: t('errorTitle'), description: t('loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function createSkill() {
  if (!newSkill.value.name || !newSkill.value.description || !newSkill.value.instructions) {
    toast.add({ title: t('errorTitle'), description: t('fieldsRequired'), color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/skills', {
      method: 'POST',
      body: newSkill.value,
    })
    showCreateModal.value = false
    newSkill.value = { name: '', description: '', instructions: '', isGlobal: false }
    await fetchSkills()
    toast.add({ title: t('skillCreated'), color: 'success' })
  } catch {
    toast.add({ title: t('errorTitle'), description: t('createFailed'), color: 'error' })
  }
}

async function importFromZip() {
  if (!importData.value.zipFile) {
    toast.add({ title: t('errorTitle'), description: t('selectZipRequired'), color: 'error' })
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await $fetch('/api/ai-tools/skills/pull-from?importFrom=zip', {
        method: 'POST',
        body: { zip_base64: base64 },
      })
      showImportModal.value = false
      importData.value.zipFile = null
      await fetchSkills()
      toast.add({ title: t('skillImported'), color: 'success' })
    }
    reader.onerror = () => {
      toast.add({ title: t('importError'), color: 'error' })
    }
    reader.readAsDataURL(importData.value.zipFile)
  } catch {
    toast.add({ title: t('importError'), color: 'error' })
  }
}

async function importFromUrl() {
  if (!importData.value.url) {
    toast.add({ title: t('errorTitle'), description: t('urlRequired'), color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/skills/pull-from?importFrom=url', {
      method: 'POST',
      body: { url: importData.value.url },
    })
    showImportModal.value = false
    importData.value.url = ''
    await fetchSkills()
    toast.add({ title: t('skillImported'), color: 'success' })
  } catch {
    toast.add({ title: t('importError'), color: 'error' })
  }
}

async function importFromFolder() {
  if (!importData.value.folderPath) {
    toast.add({ title: t('errorTitle'), description: t('folderRequired'), color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/skills/pull-from?importFrom=folder', {
      method: 'POST',
      body: { folder_path: importData.value.folderPath },
    })
    showImportModal.value = false
    importData.value.folderPath = ''
    await fetchSkills()
    toast.add({ title: t('skillImported'), color: 'success' })
  } catch {
    toast.add({ title: t('importError'), color: 'error' })
  }
}

async function deleteSkill(skill: Skill) {
  try {
    await $fetch(`/api/ai-tools/skills/${skill.id}`, { method: 'DELETE' })
    await fetchSkills()
    toast.add({ title: t('skillDeleted'), color: 'success' })
  } catch {
    toast.add({ title: t('errorTitle'), description: t('deleteFailed'), color: 'error' })
  }
}

async function toggleSkill(skill: Skill) {
  try {
    await $fetch(`/api/ai-tools/skills/${skill.id}`, {
      method: 'PUT',
      body: { enabled: !skill.enabled },
    })
    await fetchSkills()
  } catch {
    toast.add({ title: t('errorTitle'), description: t('toggleFailed'), color: 'error' })
  }
}

async function updateSkill() {
  if (!selectedSkill.value) return

  try {
    await $fetch(`/api/ai-tools/skills/${selectedSkill.value.id}`, {
      method: 'PUT',
      body: {
        name: selectedSkill.value.name,
        description: selectedSkill.value.description,
        instructions: selectedSkill.value.instructions,
      },
    })
    showEditModal.value = false
    selectedSkill.value = null
    await fetchSkills()
    toast.add({ title: t('skillUpdated'), color: 'success' })
  } catch {
    toast.add({ title: t('errorTitle'), description: t('updateFailed'), color: 'error' })
  }
}

onMounted(() => {
  fetchSkills()
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
    <template #actions>
      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-down-tray" @click="handleOpenImport">
          {{ t('importSkill') }}
        </UButton>
        <UButton color="primary" icon="i-heroicons-plus" data-testid="skills-create" @click="handleOpenCreate">
          {{ t('newSkill') }}
        </UButton>
      </div>
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchPlaceholder')"
        :view="view"
        :views="viewOptions"
        :busy="loading"
        @update:search="setSearch"
        @update:view="handleViewChange"
      />
    </template>

    <BaseCollectionGrid
      v-if="view === 'grid'"
      :items="filtered"
      :row-key="skillRowKey"
      :loading="loading && filtered.length === 0"
      :empty-title="t('noSkills')"
      empty-icon="i-heroicons-cube"
    >
      <template #item="{ item: skill }">
        <BaseCollectionCard
          :title="skill.name"
          :description="skill.description"
          icon="i-heroicons-cube"
          :badge="skillState(skill)"
          :badge-color="skillTone(skill)"
        >
          <div v-if="skill.isGlobal" class="mt-2 flex flex-wrap gap-1">
            <UBadge color="neutral" variant="subtle" size="xs">{{ t('global') }}</UBadge>
          </div>

          <template #meta>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-clock" class="size-3.5" />
              {{ t('updated') }}: {{ shortDate(skill.updatedAt) }}
            </span>
          </template>

          <template #footer>
            <div class="flex w-full items-center justify-between gap-2">
              <UTooltip :text="skillToggleLabel(skill)">
                <USwitch
                  :model-value="skill.enabled"
                  :aria-label="skillToggleLabel(skill)"
                  @update:model-value="() => toggleSkill(skill)"
                />
              </UTooltip>
              <div class="flex items-center gap-1">
                <UTooltip :text="t('edit')">
                  <UButton variant="ghost" size="xs" icon="i-heroicons-pencil" :aria-label="t('edit')"
                    @click="() => handleOpenEdit(skill)" />
                </UTooltip>
                <UTooltip :text="t('delete')">
                  <UButton variant="ghost" size="xs" color="error" icon="i-heroicons-trash" :aria-label="t('delete')"
                    @click="() => deleteSkill(skill)" />
                </UTooltip>
              </div>
            </div>
          </template>
        </BaseCollectionCard>
      </template>

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
          {{ t('clearFilters') }}
        </UButton>
        <UButton v-else icon="i-heroicons-plus" @click="handleOpenCreate">{{ t('createFirst') }}</UButton>
      </template>
    </BaseCollectionGrid>

    <BaseCollectionList
      v-else
      :items="filtered"
      :row-key="skillRowKey"
      :loading="loading && filtered.length === 0"
      :empty-title="t('noSkills')"
      empty-icon="i-heroicons-cube"
    >
      <template #item="{ item: skill }">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
          <UIcon name="i-heroicons-cube" class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-medium text-highlighted">{{ skill.name }}</p>
            <UBadge v-if="skill.isGlobal" color="neutral" variant="subtle" size="xs">{{ t('global') }}</UBadge>
            <UBadge :color="skillTone(skill)" variant="subtle" size="xs">{{ skillState(skill) }}</UBadge>
          </div>
          <p class="truncate text-sm text-muted">{{ skill.description }}</p>
        </div>
        <span class="hidden shrink-0 text-xs text-muted sm:block">{{ t('updated') }}: {{ shortDate(skill.updatedAt) }}</span>
        <div class="flex shrink-0 items-center gap-1">
          <UTooltip :text="skillToggleLabel(skill)">
            <USwitch
              :model-value="skill.enabled"
              :aria-label="skillToggleLabel(skill)"
              @update:model-value="() => toggleSkill(skill)"
            />
          </UTooltip>
          <UButton variant="ghost" size="xs" icon="i-heroicons-pencil" :aria-label="t('edit')"
            @click="() => handleOpenEdit(skill)" />
          <UButton variant="ghost" size="xs" color="error" icon="i-heroicons-trash" :aria-label="t('delete')"
            @click="() => deleteSkill(skill)" />
        </div>
      </template>

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
          {{ t('clearFilters') }}
        </UButton>
        <UButton v-else icon="i-heroicons-plus" @click="handleOpenCreate">{{ t('createFirst') }}</UButton>
      </template>
    </BaseCollectionList>

    <UModal v-model:open="showCreateModal" :title="t('createSkill')">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium">{{ t('name') }}</label>
            <UInput v-model="newSkill.name" :placeholder="t('namePlaceholder')" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">{{ t('description') }}</label>
            <UInput v-model="newSkill.description" :placeholder="t('descriptionPlaceholder')" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">{{ t('instructions') }}</label>
            <UTextarea v-model="newSkill.instructions" :rows="6" :placeholder="t('instructionsPlaceholder')" />
          </div>
          <div class="flex items-center gap-2">
            <USwitch v-model="newSkill.isGlobal" />
            <label class="text-sm">{{ t('makeGlobal') }}</label>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" @click="handleCloseCreate">{{ t('cancel') }}</UButton>
          <UButton color="primary" @click="createSkill">{{ t('create') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showEditModal" :title="t('editSkill')">
      <template #body>
        <div v-if="selectedSkill" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium">{{ t('name') }}</label>
            <UInput v-model="selectedSkill.name" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">{{ t('description') }}</label>
            <UInput v-model="selectedSkill.description" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">{{ t('instructions') }}</label>
            <UTextarea v-model="selectedSkill.instructions" :rows="6" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" @click="handleCloseEdit">{{ t('cancel') }}</UButton>
          <UButton color="primary" @click="updateSkill">{{ t('save') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showImportModal" :title="t('importSkillTitle')">
      <template #body>
        <div class="space-y-4">
          <div class="mb-4 flex flex-wrap gap-2">
            <UButton
              v-for="mode in importModes"
              :key="mode.value"
              :color="importMode === mode.value ? 'primary' : 'neutral'"
              variant="outline"
              size="sm"
              @click="handleSelectImportMode(mode.value)"
            >
              {{ mode.label }}
            </UButton>
          </div>

          <div v-if="importMode === 'zip'">
            <label class="mb-1 block text-sm font-medium">{{ t('zipFile') }}</label>
            <input
              type="file"
              accept=".zip"
              class="block w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
              @change="handleZipChange"
            >
          </div>

          <div v-if="importMode === 'url'">
            <label class="mb-1 block text-sm font-medium">{{ t('url') }}</label>
            <UInput v-model="importData.url" :placeholder="t('urlPlaceholder')" />
          </div>

          <div v-if="importMode === 'folder'">
            <label class="mb-1 block text-sm font-medium">{{ t('folderPath') }}</label>
            <UInput v-model="importData.folderPath" :placeholder="t('folderPlaceholder')" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" @click="handleCloseImport">{{ t('cancel') }}</UButton>
          <UButton v-if="importMode === 'zip'" color="primary" :disabled="!importData.zipFile" @click="importFromZip">
            {{ t('import') }}
          </UButton>
          <UButton v-if="importMode === 'url'" color="primary" :disabled="!importData.url" @click="importFromUrl">
            {{ t('import') }}
          </UButton>
          <UButton v-if="importMode === 'folder'" color="primary" :disabled="!importData.folderPath"
            @click="importFromFolder">
            {{ t('import') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </BaseCollectionPage>
</template>
