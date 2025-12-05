<!--  Translation file -->
<i18n src="./images.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Image Templates Page - List and manage image templates
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Template } from '#layers/BaseDB/db/schema'
import TemplateCard from '../components/TemplateCard.vue'
import CreateTemplateCard from '../components/CreateTemplateCard.vue'
import TemplateFormModal from '../components/TemplateFormModal.vue'
import DeleteTemplateModal from '../components/DeleteTemplateModal.vue'
import ViewTemplateModal from '../components/ViewTemplateModal.vue'

const TEMPLATE_TYPE = 'IMAGES' as const

const { t } = useI18n()

useHead({
    title: t('seo_title'),
    meta: [
        { name: 'description', content: t('seo_description') }
    ]
})

const { getTemplatesByType, templateList, isLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplateManager()

// Fetch templates on mount
onMounted(() => {
    getTemplatesByType(TEMPLATE_TYPE)
})

// Modal states
const isFormModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isViewModalOpen = ref(false)
const selectedTemplate = ref<Template | null>(null)

// Handlers
const handleCreate = () => {
    selectedTemplate.value = null
    isFormModalOpen.value = true
}

const handleEdit = (template: Template) => {
    selectedTemplate.value = template
    isFormModalOpen.value = true
}

const handleView = (template: Template) => {
    selectedTemplate.value = template
    isViewModalOpen.value = true
}

const handleDeleteClick = (template: Template) => {
    selectedTemplate.value = template
    isDeleteModalOpen.value = true
}

const handleSave = async (data: CreateTemplateData | UpdateTemplateData) => {
    try {
        if (selectedTemplate.value) {
            await updateTemplate(selectedTemplate.value.id, data as UpdateTemplateData, TEMPLATE_TYPE)
        } else {
            await createTemplate({ ...data, type: TEMPLATE_TYPE } as CreateTemplateData)
        }
        isFormModalOpen.value = false
        selectedTemplate.value = null
        // Refresh list
        await getTemplatesByType(TEMPLATE_TYPE)
    } catch {
        // Error is handled by composable with toast
    }
}

const handleConfirmDelete = async () => {
    if (!selectedTemplate.value) return
    try {
        await deleteTemplate(selectedTemplate.value.id)
        isDeleteModalOpen.value = false
        selectedTemplate.value = null
    } catch {
        // Error is handled by composable with toast
    }
}

const handleEditFromView = (template: Template) => {
    isViewModalOpen.value = false
    selectedTemplate.value = template
    isFormModalOpen.value = true
}
</script>

<template>
    <div class="container mx-auto py-6 space-y-6">
        <BasePageHeader :title="t('title')" :description="t('description')">
            <template #actions>
                <UButton icon="lucide:plus" color="primary" @click="handleCreate">
                    {{ t('create_template') }}
                </UButton>
            </template>
        </BasePageHeader>

        <!-- Loading state -->
        <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <USkeleton v-for="i in 8" :key="i" class="h-48 rounded-lg" />
        </div>

        <!-- Templates Grid -->
        <div v-else-if="templateList[TEMPLATE_TYPE] && templateList[TEMPLATE_TYPE].length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <CreateTemplateCard :type="TEMPLATE_TYPE" @create="handleCreate" />

            <TemplateCard v-for="template in templateList[TEMPLATE_TYPE]" :key="template.id" :template="template"
                @view="handleView" @edit="handleEdit" @delete="handleDeleteClick" />
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center py-16 space-y-4">
            <div class="p-6 rounded-full bg-success/10">
                <Icon name="lucide:image" class="size-12 text-success" />
            </div>
            <h3 class="text-xl font-semibold">{{ t('no_templates') }}</h3>
            <p class="text-muted-foreground text-center max-w-md">
                {{ t('create_first') }}
            </p>
            <UButton icon="lucide:plus" color="primary" size="lg" @click="handleCreate">
                {{ t('create_template') }}
            </UButton>
        </div>

        <!-- Modals -->
        <TemplateFormModal v-model:open="isFormModalOpen" :template="selectedTemplate" :default-type="TEMPLATE_TYPE"
            @save="handleSave" @cancel="isFormModalOpen = false" />

        <DeleteTemplateModal v-model:open="isDeleteModalOpen" :template="selectedTemplate"
            @confirm="handleConfirmDelete" @cancel="isDeleteModalOpen = false" />

        <ViewTemplateModal v-model:open="isViewModalOpen" :template="selectedTemplate" @edit="handleEditFromView"
            @close="isViewModalOpen = false" />
    </div>
</template>
<style scoped></style>
