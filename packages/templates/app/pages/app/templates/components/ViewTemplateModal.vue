<script lang="ts" setup>
/**
 *
 * Component Description: View Template Modal - Read-only view of a template
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Template } from '#layers/BaseDB/db/schema'

const props = defineProps<{
    template: Template | null
}>()

const emit = defineEmits<{
    edit: [template: Template]
    close: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const typeIcons: Record<string, string> = {
    EMAIL: 'lucide:mail',
    IMAGES: 'lucide:image',
    CHAT: 'lucide:message-circle',
    VARIABLE: 'lucide:code'
}

const formattedDate = computed(() => {
    if (!props.template) return ''
    return new Date(props.template.updatedAt).toLocaleDateString()
})

const handleEdit = () => {
    if (props.template) {
        emit('edit', props.template)
        isOpen.value = false
    }
}

const handleClose = () => {
    emit('close')
    isOpen.value = false
}
</script>

<template>
    <UModal v-model:open="isOpen" :ui="{ wrapper: 'max-w-2xl' }">
        <template #content>
            <UCard v-if="template">
                <template #header>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-lg bg-primary/10">
                                <Icon :name="typeIcons[template.type] || 'lucide:file'" class="size-5 text-primary" />
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold">{{ template.title }}</h3>
                                <p class="text-sm text-muted-foreground">
                                    {{ t('last_updated') }}: {{ formattedDate }}
                                </p>
                            </div>
                        </div>
                        <UButton icon="lucide:x" variant="ghost" size="xs" @click="handleClose" />
                    </div>
                </template>

                <template #default>
                    <div class="space-y-4">
                        <div class="flex items-center gap-2">
                            <UBadge variant="outline">{{ template.type }}</UBadge>
                            <UBadge :color="template.isPublic ? 'success' : 'neutral'" variant="subtle">
                                {{ template.isPublic ? t('public') : t('private') }}
                            </UBadge>
                        </div>

                        <div class="p-4 rounded-lg bg-muted/30 border max-h-96 overflow-auto">
                            <pre class="whitespace-pre-wrap text-sm">{{ template.content }}</pre>
                        </div>
                    </div>
                </template>

                <template #footer>
                    <div class="flex justify-end gap-3">
                        <UButton variant="ghost" @click="handleClose">
                            {{ t('close') }}
                        </UButton>
                        <UButton color="primary" icon="lucide:edit" @click="handleEdit">
                            {{ t('edit') }}
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
    "last_updated": "Last updated",
    "public": "Public",
    "private": "Private",
    "close": "Close",
    "edit": "Edit"
  },
  "es": {
    "last_updated": "Última actualización",
    "public": "Público",
    "private": "Privado",
    "close": "Cerrar",
    "edit": "Editar"
  },
  "de": {
    "last_updated": "Zuletzt aktualisiert",
    "public": "Öffentlich",
    "private": "Privat",
    "close": "Schließen",
    "edit": "Bearbeiten"
  },
  "fr": {
    "last_updated": "Dernière mise à jour",
    "public": "Public",
    "private": "Privé",
    "close": "Fermer",
    "edit": "Modifier"
  }
}
</i18n>

<style scoped></style>
