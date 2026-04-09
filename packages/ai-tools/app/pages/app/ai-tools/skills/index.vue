<i18n src="./skills.json"></i18n>

<script setup lang="ts">
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

const { t } = useI18n()
const toast = useToast()

const skills = ref<Skill[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showImportModal = ref(false)
const importMode = ref<'zip' | 'url' | 'folder'>('zip')
const selectedSkill = ref<Skill | null>(null)

const newSkill = ref({
  name: '',
  description: '',
  instructions: '',
  isGlobal: false
})

const importData = ref({
  zipFile: null as File | null,
  url: '',
  folderPath: ''
})

async function fetchSkills() {
  loading.value = true
  try {
    const data = await $fetch<Skill[]>('/api/ai-tools/skills')
    skills.value = data || []
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to load skills', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function createSkill() {
  if (!newSkill.value.name || !newSkill.value.description || !newSkill.value.instructions) {
    toast.add({ title: 'Error', description: 'All fields are required', color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/skills', {
      method: 'POST',
      body: newSkill.value
    })
    showCreateModal.value = false
    newSkill.value = { name: '', description: '', instructions: '', isGlobal: false }
    await fetchSkills()
    toast.add({ title: t('skillCreated'), color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to create skill', color: 'error' })
  }
}

async function importFromZip() {
  if (!importData.value.zipFile) {
    toast.add({ title: 'Error', description: 'Please select a ZIP file', color: 'error' })
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await $fetch('/api/ai-tools/skills/pull-from?importFrom=zip', {
        method: 'POST',
        body: { zip_base64: base64 }
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
  } catch (e) {
    toast.add({ title: t('importError'), color: 'error' })
  }
}

async function importFromUrl() {
  if (!importData.value.url) {
    toast.add({ title: 'Error', description: 'Please enter a URL', color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/skills/pull-from?importFrom=url', {
      method: 'POST',
      body: { url: importData.value.url }
    })
    showImportModal.value = false
    importData.value.url = ''
    await fetchSkills()
    toast.add({ title: t('skillImported'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('importError'), color: 'error' })
  }
}

async function importFromFolder() {
  if (!importData.value.folderPath) {
    toast.add({ title: 'Error', description: 'Please enter a folder path', color: 'error' })
    return
  }

  try {
    await $fetch('/api/ai-tools/skills/pull-from?importFrom=folder', {
      method: 'POST',
      body: { folder_path: importData.value.folderPath }
    })
    showImportModal.value = false
    importData.value.folderPath = ''
    await fetchSkills()
    toast.add({ title: t('skillImported'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('importError'), color: 'error' })
  }
}

async function deleteSkill(skill: Skill) {
  try {
    await $fetch(`/api/ai-tools/skills/${skill.id}`, { method: 'DELETE' })
    await fetchSkills()
    toast.add({ title: t('skillDeleted'), color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to delete skill', color: 'error' })
  }
}

async function toggleSkill(skill: Skill) {
  try {
    await $fetch(`/api/ai-tools/skills/${skill.id}`, {
      method: 'PUT',
      body: { enabled: !skill.enabled }
    })
    await fetchSkills()
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to update skill', color: 'error' })
  }
}

function openEdit(skill: Skill) {
  selectedSkill.value = { ...skill }
  showEditModal.value = true
}

async function updateSkill() {
  if (!selectedSkill.value) return

  try {
    await $fetch(`/api/ai-tools/skills/${selectedSkill.value.id}`, {
      method: 'PUT',
      body: {
        name: selectedSkill.value.name,
        description: selectedSkill.value.description,
        instructions: selectedSkill.value.instructions
      }
    })
    showEditModal.value = false
    selectedSkill.value = null
    await fetchSkills()
    toast.add({ title: t('skillUpdated'), color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to update skill', color: 'error' })
  }
}

onMounted(() => {
  fetchSkills()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-semibold">{{ t('title') }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="outline" @click="showImportModal = true">
          <UIcon name="i-heroicons-arrow-down-tray" class="mr-1" />
          {{ t('importSkill') }}
        </UButton>
        <UButton color="primary" @click="showCreateModal = true">
          <UIcon name="i-heroicons-plus" class="mr-1" />
          {{ t('newSkill') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <UProgress indicator />
    </div>

    <div v-else-if="skills.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center py-12">
        <UIcon name="i-heroicons-cube" class="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p class="text-gray-500">{{ t('noSkills') }}</p>
        <UButton class="mt-4" @click="showCreateModal = true">
          {{ t('createFirst') }}
        </UButton>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-4">
      <div class="grid gap-4">
        <div v-for="skill in skills" :key="skill.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-medium">{{ skill.name }}</h3>
                <UBadge v-if="skill.isGlobal" color="neutral" variant="subtle">
                  {{ t('global') }}
                </UBadge>
                <UBadge :color="skill.enabled ? 'primary' : 'neutral'" variant="subtle">
                  {{ skill.enabled ? t('enabled') : t('disabled') }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ skill.description }}</p>
              <p class="text-xs text-gray-400 mt-2">
                {{ t('updated') }}: {{ new Date(skill.updatedAt).toLocaleDateString() }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UTooltip :text="skill.enabled ? t('disable') : t('enable')">
                <USwitch :modelValue="skill.enabled" @update:modelValue="toggleSkill(skill)" />
              </UTooltip>
              <UTooltip :text="t('edit')">
                <UButton variant="ghost" size="sm" @click="openEdit(skill)">
                  <UIcon name="i-heroicons-pencil" />
                </UButton>
              </UTooltip>
              <UTooltip :text="t('delete')">
                <UButton variant="ghost" size="sm" color="error" @click="deleteSkill(skill)">
                  <UIcon name="i-heroicons-trash" />
                </UButton>
              </UTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UModal v-model:open="showCreateModal" :title="t('createSkill')">
      <template #content>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t('name') }}</label>
            <UInput v-model="newSkill.name" :placeholder="t('namePlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t('description') }}</label>
            <UInput v-model="newSkill.description" :placeholder="t('descriptionPlaceholder')" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t('instructions') }}</label>
            <UTextarea v-model="newSkill.instructions" :rows="6" :placeholder="t('instructionsPlaceholder')" />
          </div>
          <div class="flex items-center gap-2">
            <USwitch v-model="newSkill.isGlobal" />
            <label class="text-sm">{{ t('makeGlobal') }}</label>
          </div>
        </div>
        <UButton @click="showCreateModal = false" variant="ghost">{{ t('cancel') }}</UButton>
        <UButton @click="createSkill" color="primary">{{ t('create') }}</UButton>
      </template>
    </UModal>

    <UModal v-model:open="showEditModal" :title="t('editSkill')">
      <template #content>

        <div class="p-4 space-y-4" v-if="selectedSkill">
          <div>
            <label class="block text-sm font-medium mb-1">{{ t('name') }}</label>
            <UInput v-model="selectedSkill.name" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t('description') }}</label>
            <UInput v-model="selectedSkill.description" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">{{ t('instructions') }}</label>
            <UTextarea v-model="selectedSkill.instructions" :rows="6" />
          </div>
        </div>
        <UButton @click="showEditModal = false" variant="ghost">{{ t('cancel') }}</UButton>
        <UButton @click="updateSkill" color="primary">{{ t('save') }}</UButton>
      </template>
    </UModal>

    <UModal v-model:open="showImportModal" :title="t('importSkillTitle')">
      <template #content>
        <div class="p-4 space-y-4">
          <div class="flex gap-2 mb-4">
            <UButton :color="importMode === 'zip' ? 'primary' : 'neutral'" variant="outline" size="sm"
              @click="importMode = 'zip'">
              {{ t('importFromZip') }}
            </UButton>
            <UButton :color="importMode === 'url' ? 'primary' : 'neutral'" variant="outline" size="sm"
              @click="importMode = 'url'">
              {{ t('importFromUrl') }}
            </UButton>
            <UButton :color="importMode === 'folder' ? 'primary' : 'neutral'" variant="outline" size="sm"
              @click="importMode = 'folder'">
              {{ t('importFromFolder') }}
            </UButton>
          </div>

          <div v-if="importMode === 'zip'">
            <label class="block text-sm font-medium mb-1">{{ t('zipFile') }}</label>
            <input type="file" accept=".zip"
              @change="(e) => importData.zipFile = (e.target as HTMLInputElement).files?.[0] || null"
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
          </div>

          <div v-if="importMode === 'url'">
            <label class="block text-sm font-medium mb-1">{{ t('url') }}</label>
            <UInput v-model="importData.url" :placeholder="t('urlPlaceholder')" />
          </div>

          <div v-if="importMode === 'folder'">
            <label class="block text-sm font-medium mb-1">{{ t('folderPath') }}</label>
            <UInput v-model="importData.folderPath" :placeholder="t('folderPlaceholder')" />
          </div>
        </div>
        <section class="flex justify-end gap-2 p-4">
          <UButton @click="showImportModal = false" variant="ghost">{{ t('cancel') }}</UButton>
          <UButton v-if="importMode === 'zip'" @click="importFromZip" color="primary" :disabled="!importData.zipFile">
            {{ t('import') }}
          </UButton>
          <UButton v-if="importMode === 'url'" @click="importFromUrl" color="primary" :disabled="!importData.url">
            {{ t('import') }}
          </UButton>
          <UButton v-if="importMode === 'folder'" @click="importFromFolder" color="primary"
            :disabled="!importData.folderPath">
            {{ t('import') }}
          </UButton>
        </section>
      </template>
    </UModal>
  </div>
</template>
