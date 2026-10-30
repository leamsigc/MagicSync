<!--  Translation file -->
<i18n src="./images.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Image Templates Page - List and manage image templates
 *
 * Uses the shared collection shell: `BaseCollectionPage` for the page rhythm,
 * `BaseCollectionToolbar` for search/visibility, and the shared grid/list with
 * the existing `TemplateCard` / `CreateTemplateCard` for the rows.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Template } from '#layers/BaseDB/db/schema'
import TemplateCard from '#layers/BaseTemplate/app/components/templates/components/TemplateCard.vue'
import CreateTemplateCard from '#layers/BaseTemplate/app/components/templates/components/CreateTemplateCard.vue'
import TemplateFormModal from '#layers/BaseTemplate/app/components/templates/components/TemplateFormModal.vue'
import DeleteTemplateModal from '#layers/BaseTemplate/app/components/templates/components/DeleteTemplateModal.vue'
import ViewTemplateModal from '#layers/BaseTemplate/app/components/templates/components/ViewTemplateModal.vue'

const TEMPLATE_TYPE = 'IMAGES' as const
const EMPTY_ICON = 'lucide:image'
/** Sentinel row so the "create" tile rides inside the shared grid. */
const CREATE_TILE_ID = '__create__'

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

// Collection state: grid + list, search, visibility filter
const rows = computed(() => templateList[TEMPLATE_TYPE] ?? [])

const { view, setView, search, setSearch, filters, setFilter, filtered } = useCollectionView<Template>({
    key: 'app-templates-images',
    modes: ['grid', 'list'],
    defaultView: 'grid',
    rows,
    searchFields: row => [row.title, row.content],
    filterFns: {
        visibility: (row, value) => value === 'public' ? row.isPublic : !row.isPublic,
    },
})

interface TemplateTile {
    id: string
    template?: Template
}

const isCreateTile = (item: { id?: string }) => item.id === CREATE_TILE_ID

/** Empty collection → let the shared empty state own the CTA. */
const gridItems = computed<TemplateTile[]>(() => {
    if (filtered.value.length === 0) return []
    return [{ id: CREATE_TILE_ID }, ...filtered.value.map(row => ({ id: row.id, template: row }))]
})

const visibilityOptions = computed(() => [
    { value: 'all', label: t('visibility_all') },
    { value: 'public', label: t('visibility_public') },
    { value: 'private', label: t('visibility_private') },
])

const toolbarFilters = computed(() => [
    { key: 'visibility', label: t('visibility_label'), value: filters.value.visibility || 'all', options: visibilityOptions.value, width: 'w-full sm:w-44' },
])

const viewOptions = computed(() => [
    { value: 'grid', label: t('view_grid'), icon: 'i-lucide-layout-grid' },
    { value: 'list', label: t('view_list'), icon: 'i-lucide-list' },
])

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

const closeFormModal = () => {
    isFormModalOpen.value = false
}

const closeDeleteModal = () => {
    isDeleteModalOpen.value = false
}

const closeViewModal = () => {
    isViewModalOpen.value = false
}

// Row helpers
const visibilityLabel = (template: Template) =>
    template.isPublic ? t('visibility_public') : t('visibility_private')

const visibilityColor = (template: Template): 'success' | 'neutral' =>
    template.isPublic ? 'success' : 'neutral'

const formatDate = (template: Template) => new Date(template.updatedAt).toLocaleDateString()

const menuItems = (template: Template) => [[
    { label: t('action_view'), icon: 'lucide:eye', onSelect: () => handleView(template) },
    { label: t('action_edit'), icon: 'lucide:edit', onSelect: () => handleEdit(template) },
    { label: t('action_delete'), icon: 'lucide:trash', color: 'error' as const, onSelect: () => handleDeleteClick(template) },
]]
</script>

<template>
    <BaseCollectionPage :title="t('title')" :description="t('description')" back-to="">
        <template #actions>
            <UButton icon="lucide:plus" color="primary" @click="handleCreate">
                {{ t('create_template') }}
            </UButton>
        </template>

        <template #toolbar>
            <BaseCollectionToolbar :search="search" :search-placeholder="t('search_placeholder')"
                :filters="toolbarFilters" :view="view" :views="viewOptions" :busy="isLoading"
                @update:search="setSearch" @update:filter="(key: string, value: string) => setFilter(key, value)"
                @update:view="setView" />
        </template>

        <!-- Templates Grid -->
        <BaseCollectionGrid v-if="view === 'grid'" :items="gridItems" row-key="id" :columns="4" :loading="isLoading"
            :empty-icon="EMPTY_ICON" :empty-title="t('no_templates')" :empty-hint="t('create_first')">
            <template #item="{ item }">
                <CreateTemplateCard v-if="isCreateTile(item)" :type="TEMPLATE_TYPE" @create="handleCreate" />
                <TemplateCard v-else :template="item.template" @view="handleView" @edit="handleEdit"
                    @delete="handleDeleteClick" />
            </template>

            <template #empty>
                <UButton icon="lucide:plus" color="primary" size="lg" @click="handleCreate">
                    {{ t('create_template') }}
                </UButton>
            </template>
        </BaseCollectionGrid>

        <!-- Templates List -->
        <BaseCollectionList v-else :items="filtered" row-key="id" :loading="isLoading" :empty-icon="EMPTY_ICON"
            :empty-title="t('no_templates')" :empty-hint="t('create_first')">
            <template #item="{ item }">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
                    <UIcon :name="EMPTY_ICON" class="size-5 text-primary" />
                </span>

                <div class="min-w-0 flex-1 cursor-pointer" @click="handleView(item)">
                    <p class="truncate text-sm font-medium text-highlighted">{{ item.title }}</p>
                    <p class="truncate text-sm text-muted">{{ item.content }}</p>
                </div>

                <UBadge :color="visibilityColor(item)" variant="subtle" size="sm"
                    class="hidden shrink-0 sm:inline-flex">
                    {{ visibilityLabel(item) }}
                </UBadge>

                <span class="hidden w-28 shrink-0 whitespace-nowrap text-right text-xs text-muted lg:block">
                    {{ formatDate(item) }}
                </span>

                <UDropdownMenu :items="menuItems(item)" :content="{ align: 'end' }">
                    <UButton icon="lucide:more-vertical" color="neutral" variant="ghost" size="xs"
                        :aria-label="t('actions')" />
                </UDropdownMenu>
            </template>

            <template #empty>
                <UButton icon="lucide:plus" color="primary" size="lg" @click="handleCreate">
                    {{ t('create_template') }}
                </UButton>
            </template>
        </BaseCollectionList>

        <!-- Modals -->
        <TemplateFormModal v-model:open="isFormModalOpen" :template="selectedTemplate" :default-type="TEMPLATE_TYPE"
            @save="handleSave" @cancel="closeFormModal" />

        <DeleteTemplateModal v-model:open="isDeleteModalOpen" :template="selectedTemplate"
            @confirm="handleConfirmDelete" @cancel="closeDeleteModal" />

        <ViewTemplateModal v-model:open="isViewModalOpen" :template="selectedTemplate" @edit="handleEditFromView"
            @close="closeViewModal" />
    </BaseCollectionPage>
</template>
<style scoped></style>
