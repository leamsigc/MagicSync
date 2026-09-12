<i18n src="../pipelines.json"></i18n>

<script lang="ts" setup>
import { usePipelineManager } from '../composables/UsePipelineManager'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { pipelineList, activeBusinessId, startRun } = usePipelineManager()

const isOpen = ref(false)
const isStarting = ref(false)
const selectedPipelineId = ref('')
const brief = ref('')
const useBusinessContext = ref(false)

const pipelineItems = computed(() => pipelineList.value.map(pipeline => ({
  label: pipeline.name,
  value: pipeline.id
})))

function openModal() {
  if (!selectedPipelineId.value && pipelineList.value.length > 0) {
    selectedPipelineId.value = pipelineList.value[0]?.id ?? ''
  }
  isOpen.value = true
}

function closeModal() {
  isOpen.value = false
}

async function handleStart() {
  if (!selectedPipelineId.value) {
    toast.add({ title: t('toast.pipelineRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  if (!brief.value.trim()) {
    toast.add({ title: t('toast.briefRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  isStarting.value = true
  try {
    const run = await startRun(selectedPipelineId.value, activeBusinessId.value, {
      brief: brief.value.trim(),
      useBusinessContext: useBusinessContext.value
    })
    closeModal()
    brief.value = ''
    if (run) {
      router.push(`/app/pipelines/runs/${run.id}`)
    }
  }
  finally {
    isStarting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :dismissible="false">
    <UButton color="primary" variant="solid" icon="i-lucide-play" @click="openModal">
      {{ t('startModal.trigger') }}
    </UButton>
    <template #content>
      <UCard>
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">{{ t('startModal.title') }}</h2>
            <p class="text-sm text-muted">{{ t('startModal.description') }}</p>
          </div>
        </template>

        <div class="space-y-4">
          <UFormField :label="t('startModal.pipeline')" name="pipeline">
            <USelect v-model="selectedPipelineId" :items="pipelineItems" :placeholder="t('startModal.pipelinePlaceholder')" class="w-full" />
          </UFormField>

          <UFormField :label="t('startModal.brief')" name="brief">
            <UTextarea v-model="brief" :placeholder="t('startModal.briefPlaceholder')" :rows="5" class="w-full" />
          </UFormField>

          <UFormField :label="t('startModal.useContext')" :description="t('startModal.useContextHint')" name="useBusinessContext">
            <UCheckbox v-model="useBusinessContext" />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="closeModal">
              {{ t('startModal.cancel') }}
            </UButton>
            <UButton color="primary" variant="solid" :loading="isStarting" @click="handleStart">
              {{ t('startModal.submit') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<style scoped></style>
