<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Project detail page - shows specific project by ID
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import ProjectDetailComponent from '#layers/BaseTools/app/components/tools/audio-transcription/ProjectDetail.vue'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.id as string)
const project = ref<Awaited<ReturnType<typeof getProject>>>(undefined)
const isLoading = ref(true)

const { updateProject } = useProject()

onMounted(async () => {
  if (projectId.value) {
    project.value = await getProject(projectId.value)
  }
  isLoading.value = false
})


const handleBack = () => {
  router.push('/tools/audio-transcription')
}

const handleUpdate = (id: string, updates: Record<string, unknown>) => {
  updateProject(id, updates)
  project.value = { ...project.value, ...updates } as typeof project.value
}

useHead({
  title: project.value?.filename ? `${project.value.filename} - MagicSync Free transcription` : 'Project - MagicSync Free transcription',
  meta: [{ name: 'description', content: 'View and edit your transcription project' }]
})

defineOgImage('BlogOgImage', {
  title: project.value?.filename ? `${project.value.filename} - MagicSync Free transcription` : 'Project - MagicSync Free transcription',
  description: 'View and edit your transcription project',
  headline: 'Free Tools',
  imageUrl: '/img/audio-transcription.png',
})
</script>

<template>
  <div class="min-h-screen   font-sans ">
    <BaseHeader />
    <div class="max-w-6xl mx-auto p-6">
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-emerald-400 animate-spin" />
      </div>

      <div v-else-if="!project" class="text-center py-20">
        <UIcon name="i-lucide-file-x" class="w-16 h-16 mx-auto text-gray-500 mb-4" />
        <h2 class="text-xl font-semibold mb-2">Project not found</h2>
        <p class="text-gray-400 mb-6">The project you're looking for doesn't exist or has been deleted.</p>
        <UButton color="primary" icon="i-lucide-arrow-left" @click="handleBack">
          Back to Projects
        </UButton>
      </div>

      <ProjectDetailComponent v-else :project="project" @back="handleBack" @update="handleUpdate" />
    </div>
  </div>
</template>
