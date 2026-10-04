<i18n src="#site/app/pages/app/business/business.json"></i18n>
<script lang="ts" setup>
import { extractDeleteErrorMessage, useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';
import type { BusinessDeletePreview } from '#layers/BaseShared/app/composables/useBusinessManager';

const props = defineProps<{
  modelValue: boolean
  businessId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'deleted': [businessId: string]
}>()

const { t } = useI18n()
const toast = useToast()
const { addBusiness, deleteBusiness, getAllBusinesses, getDeletePreview } = useBusinessManager()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const preview = ref<BusinessDeletePreview | null>(null)
const previewLoading = ref(false)
const confirmLoading = ref(false)
const createLoading = ref(false)
const selectedTarget = ref<string | undefined>(undefined)
const newBusinessName = ref('')

const hasSocialAccounts = computed(() => (preview.value?.socialAccounts.length ?? 0) > 0)
const needsSelection = computed(() => hasSocialAccounts.value && selectedTarget.value === undefined)

function handleClose() {
  isOpen.value = false
}

function handleSelectTarget(id: string) {
  selectedTarget.value = id
}

async function loadPreview() {
  if (!props.businessId) return
  previewLoading.value = true
  preview.value = null
  selectedTarget.value = undefined
  try {
    preview.value = await getDeletePreview(props.businessId)
  } catch (error) {
    toast.add({
      title: t('states.error'),
      description: extractDeleteErrorMessage(error, t('states.something_went_wrong')),
      color: 'error'
    })
    handleClose()
  } finally {
    previewLoading.value = false
  }
}

async function handleCreateBusiness() {
  if (!newBusinessName.value.trim()) {
    toast.add({
      title: t('states.error'),
      description: t('delete_modal.new_business_name_required'),
      color: 'warning'
    })
    return
  }
  createLoading.value = true
  try {
    const created = await addBusiness({
      name: newBusinessName.value.trim(),
      description: '',
      address: '',
      phone: '',
      website: '',
      category: ''
    })
    newBusinessName.value = ''
    await loadPreview()
    if (created?.id) selectedTarget.value = created.id
    toast.add({
      title: t('states.business_added'),
      description: t('states.business_added_successfully'),
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: t('states.error'),
      description: extractDeleteErrorMessage(error, t('states.something_went_wrong')),
      color: 'error'
    })
  } finally {
    createLoading.value = false
  }
}

async function handleConfirmDelete() {
  if (!props.businessId || !preview.value) return
  if (needsSelection.value) {
    toast.add({
      title: t('states.error'),
      description: t('delete_modal.select_target_required'),
      color: 'warning'
    })
    return
  }
  confirmLoading.value = true
  try {
    await deleteBusiness(props.businessId, selectedTarget.value)
    await getAllBusinesses()
    toast.add({
      title: t('states.deleted'),
      description: t('states.business_deleted'),
      color: 'success'
    })
    emit('deleted', props.businessId)
    handleClose()
  } catch (error) {
    toast.add({
      title: t('states.error'),
      description: extractDeleteErrorMessage(error, t('states.something_went_wrong')),
      color: 'error'
    })
  } finally {
    confirmLoading.value = false
  }
}

watch([isOpen, () => props.businessId], ([open]) => {
  if (open) loadPreview()
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('delete_modal.title')" :description="t('delete_modal.description')"
    :ui="{ content: 'md:min-w-[640px]' }">
    <template #body>
      <div v-if="previewLoading" class="flex justify-center p-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div v-else-if="preview" v-motion-fade class="space-y-5">
        <p class="text-sm text-muted">
          {{ t('delete_modal.removed_hint', { name: preview.businessName }) }}
        </p>

        <ul class="grid grid-cols-2 gap-2 text-sm">
          <li class="rounded-lg bg-muted p-2.5">
            {{ t('delete_modal.count_posts', { count: preview.counts.posts }) }}
          </li>
          <li class="rounded-lg bg-muted p-2.5">
            {{ t('delete_modal.count_pipelines', { count: preview.counts.pipelines }) }}
          </li>
          <li class="rounded-lg bg-muted p-2.5">
            {{ t('delete_modal.count_content', { count: preview.counts.contentItems }) }}
          </li>
          <li class="rounded-lg bg-muted p-2.5">
            {{ t('delete_modal.count_connections', { count: preview.counts.publishConnections }) }}
          </li>
        </ul>

        <section v-if="hasSocialAccounts" class="space-y-3">
          <h4 class="text-sm font-semibold">
            {{ t('delete_modal.social_section', { count: preview.socialAccounts.length }) }}
          </h4>
          <ul class="space-y-1.5">
            <li v-for="account in preview.socialAccounts" :key="account.id"
              class="flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm">
              <UIcon name="i-heroicons-at-symbol" class="size-4 shrink-0 text-muted" />
              <span class="font-medium">{{ account.accountName }}</span>
              <span class="text-muted">· {{ account.platform }}</span>
            </li>
          </ul>

          <h4 class="text-sm font-semibold">
            {{ t('delete_modal.target_section') }}
          </h4>
          <div v-if="preview.availableTargets.length > 0" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button v-for="target in preview.availableTargets" :key="target.id" type="button"
              class="rounded-xl border-2 p-3 text-left transition-colors"
              :class="selectedTarget === target.id ? 'border-primary' : 'border-transparent hover:border-muted'"
              @click="handleSelectTarget(target.id)">
              <span class="flex items-center gap-2">
                <span class="size-4 shrink-0 rounded-full border-2 flex items-center justify-center"
                  :class="selectedTarget === target.id ? 'border-primary' : 'border-muted'">
                  <span v-if="selectedTarget === target.id" class="size-2 rounded-full bg-primary" />
                </span>
                <span class="font-medium">{{ target.name }}</span>
              </span>
            </button>
          </div>
          <div v-else class="space-y-2 rounded-xl border border-muted p-3">
            <p class="text-sm text-muted">
              {{ t('delete_modal.no_targets_hint') }}
            </p>
            <div class="flex gap-2">
              <UInput v-model="newBusinessName" :placeholder="t('delete_modal.new_business_name')" class="flex-1" />
              <UButton :loading="createLoading" color="primary" @click="handleCreateBusiness">
                {{ t('delete_modal.create_business') }}
              </UButton>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template #footer>
      <UButton variant="soft" color="neutral" @click="handleClose">
        {{ t('form.cancel') }}
      </UButton>
      <UButton :loading="confirmLoading" :disabled="previewLoading || !preview || needsSelection" color="error"
        @click="handleConfirmDelete">
        {{ t('actions.delete') }}
      </UButton>
    </template>
  </UModal>
</template>
