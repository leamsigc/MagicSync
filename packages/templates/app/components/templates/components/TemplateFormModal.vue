<script lang="ts" setup>
/**
 *
 * Component Description: Template Form Modal for creating and editing templates
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { TemplateType } from '#layers/BaseDB/db/schema'
import type { Template } from '#layers/BaseDB/db/schema'

const props = defineProps<{
    template?: Template | null
    defaultType?: TemplateTypeValue
}>()

const emit = defineEmits<{
    save: [data: CreateTemplateData | UpdateTemplateData]
    cancel: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const isEditing = computed(() => !!props.template)

const formData = ref<CreateTemplateData>({
    type: props.defaultType || 'EMAIL',
    title: '',
    content: '',
    isPublic: false
})
const resetForm = () => {
    formData.value = {
        type: props.defaultType || 'EMAIL',
        title: '',
        content: '',
        isPublic: false
    }
}

// Watch for template changes to populate form
watch(() => props.template, (newTemplate) => {
    if (newTemplate) {
        formData.value = {
            type: newTemplate.type as TemplateTypeValue,
            title: newTemplate.title,
            content: newTemplate.content,
            isPublic: newTemplate.isPublic
        }
    } else {
        resetForm()
    }
}, { immediate: true })

// Watch for defaultType changes
watch(() => props.defaultType, (newType) => {
    if (newType && !props.template) {
        formData.value.type = newType
    }
})


const handleSubmit = () => {
    if (!formData.value.title.trim() || !formData.value.content.trim()) {
        return
    }

    if (isEditing.value) {
        const updateData: UpdateTemplateData = {
            title: formData.value.title,
            content: formData.value.content,
            isPublic: formData.value.isPublic
        }
        emit('save', updateData)
    } else {
        emit('save', formData.value)
    }
}

const handleCancel = () => {
    resetForm()
    emit('cancel')
    isOpen.value = false
}

const typeOptions = TemplateType.map(type => ({
    value: type,
    label: type.charAt(0) + type.slice(1).toLowerCase()
}))
</script>

<template>
    <UModal v-model:open="isOpen">
        <template #content>
            <UCard>
                <template #header>
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold">
                            {{ isEditing ? t('edit_template') : t('create_template') }}
                        </h3>
                        <UButton icon="lucide:x" variant="ghost" size="xs" @click="handleCancel" />
                    </div>
                </template>

                <template #default>
                    <form class="space-y-4" @submit.prevent="handleSubmit">
                        <!-- Type Selection (only for create) -->
                        <UFormField v-if="!isEditing" :label="t('type')" name="type">
                            <USelect v-model="formData.type" :items="typeOptions" value-key="value" class="w-full" />
                        </UFormField>

                        <!-- Title -->
                        <UFormField :label="t('title')" name="title" required>
                            <UInput v-model="formData.title" :placeholder="t('title_placeholder')" class="w-full" />
                        </UFormField>

                        <!-- Content -->
                        <UFormField :label="t('content')" name="content" required>
                            <UTextarea v-model="formData.content" :placeholder="t('content_placeholder')" :rows="8"
                                class="w-full" />
                        </UFormField>

                        <!-- Public Toggle -->
                        <UFormField :label="t('visibility')" name="isPublic">
                            <div class="flex items-center gap-3">
                                <USwitch v-model="formData.isPublic" />
                                <span class="text-sm text-muted-foreground">
                                    {{ formData.isPublic ? t('public') : t('private') }}
                                </span>
                            </div>
                        </UFormField>
                    </form>
                </template>

                <template #footer>
                    <div class="flex justify-end gap-3">
                        <UButton variant="ghost" @click="handleCancel">
                            {{ t('cancel') }}
                        </UButton>
                        <UButton color="primary" :disabled="!formData.title.trim() || !formData.content.trim()"
                            @click="handleSubmit">
                            {{ isEditing ? t('save_changes') : t('create') }}
                        </UButton>
                    </div>
                </template>
            </UCard>
        </template>
    </UModal>
</template>

<i18n>
{
  "en": {
    "create_template": "Create Template",
    "edit_template": "Edit Template",
    "type": "Type",
    "title": "Title",
    "title_placeholder": "Enter template title...",
    "content": "Content",
    "content_placeholder": "Enter template content...",
    "visibility": "Visibility",
    "public": "Public - visible to everyone",
    "private": "Private - only visible to you",
    "cancel": "Cancel",
    "create": "Create",
    "save_changes": "Save Changes"
  },
  "es": {
    "create_template": "Crear Plantilla",
    "edit_template": "Editar Plantilla",
    "type": "Tipo",
    "title": "Título",
    "title_placeholder": "Ingresa el título de la plantilla...",
    "content": "Contenido",
    "content_placeholder": "Ingresa el contenido de la plantilla...",
    "visibility": "Visibilidad",
    "public": "Público - visible para todos",
    "private": "Privado - solo visible para ti",
    "cancel": "Cancelar",
    "create": "Crear",
    "save_changes": "Guardar Cambios"
  },
  "de": {
    "create_template": "Vorlage erstellen",
    "edit_template": "Vorlage bearbeiten",
    "type": "Typ",
    "title": "Titel",
    "title_placeholder": "Vorlagentitel eingeben...",
    "content": "Inhalt",
    "content_placeholder": "Vorlageninhalt eingeben...",
    "visibility": "Sichtbarkeit",
    "public": "Öffentlich - für alle sichtbar",
    "private": "Privat - nur für Sie sichtbar",
    "cancel": "Abbrechen",
    "create": "Erstellen",
    "save_changes": "Änderungen speichern"
  },
  "fr": {
    "create_template": "Créer un Modèle",
    "edit_template": "Modifier le Modèle",
    "type": "Type",
    "title": "Titre",
    "title_placeholder": "Entrez le titre du modèle...",
    "content": "Contenu",
    "content_placeholder": "Entrez le contenu du modèle...",
    "visibility": "Visibilité",
    "public": "Public - visible par tous",
    "private": "Privé - visible uniquement par vous",
    "cancel": "Annuler",
    "create": "Créer",
    "save_changes": "Enregistrer"
  }
}
</i18n>

<style scoped></style>
