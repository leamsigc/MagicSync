<script lang="ts" setup>
/**
 *
 * Component Description: Delete Template Modal - Confirmation dialog for template deletion
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Template } from '#layers/BaseDB/db/schema'

defineProps<{
    template: Template | null
}>()

const emit = defineEmits<{
    confirm: []
    cancel: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const handleConfirm = () => {
    emit('confirm')
    isOpen.value = false
}

const handleCancel = () => {
    emit('cancel')
    isOpen.value = false
}
</script>

<template>
    <UModal v-model:open="isOpen">
        <template #content>
            <UCard>
                <template #header>
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-full bg-error/10">
                            <Icon name="lucide:trash-2" class="size-5 text-error" />
                        </div>
                        <h3 class="text-lg font-semibold">{{ t('delete_template') }}</h3>
                    </div>
                </template>

                <template #default>
                    <div class="space-y-4">
                        <p class="text-muted-foreground">
                            {{ t('delete_confirmation') }}
                        </p>
                        <div v-if="template" class="p-4 rounded-lg bg-muted/50">
                            <p class="font-medium">{{ template.title }}</p>
                            <p class="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {{ template.content }}
                            </p>
                        </div>
                        <p class="text-sm text-error">
                            {{ t('delete_warning') }}
                        </p>
                    </div>
                </template>

                <template #footer>
                    <div class="flex justify-end gap-3">
                        <UButton variant="ghost" @click="handleCancel">
                            {{ t('cancel') }}
                        </UButton>
                        <UButton color="error" @click="handleConfirm">
                            {{ t('delete') }}
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
    "delete_template": "Delete Template",
    "delete_confirmation": "Are you sure you want to delete this template?",
    "delete_warning": "This action cannot be undone.",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "es": {
    "delete_template": "Eliminar Plantilla",
    "delete_confirmation": "¿Estás seguro de que deseas eliminar esta plantilla?",
    "delete_warning": "Esta acción no se puede deshacer.",
    "cancel": "Cancelar",
    "delete": "Eliminar"
  },
  "de": {
    "delete_template": "Vorlage löschen",
    "delete_confirmation": "Sind Sie sicher, dass Sie diese Vorlage löschen möchten?",
    "delete_warning": "Diese Aktion kann nicht rückgängig gemacht werden.",
    "cancel": "Abbrechen",
    "delete": "Löschen"
  },
  "fr": {
    "delete_template": "Supprimer le Modèle",
    "delete_confirmation": "Êtes-vous sûr de vouloir supprimer ce modèle ?",
    "delete_warning": "Cette action est irréversible.",
    "cancel": "Annuler",
    "delete": "Supprimer"
  }
}
</i18n>

<style scoped></style>
