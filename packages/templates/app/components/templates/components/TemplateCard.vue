<script lang="ts" setup>
/**
 *
 * Component Description: Template Card component for displaying a template in the grid
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
    template: Template
}>()

const emit = defineEmits<{
    edit: [template: Template]
    delete: [template: Template]
    view: [template: Template]
}>()

const typeIcons: Record<string, string> = {
    EMAIL: 'lucide:mail',
    IMAGES: 'lucide:image',
    CHAT: 'lucide:message-circle',
    VARIABLE: 'lucide:code'
}

const typeColors: Record<string, string> = {
    EMAIL: 'primary',
    IMAGES: 'success',
    CHAT: 'info',
    VARIABLE: 'warning'
}

const formattedDate = computed(() => {
    return new Date(props.template.updatedAt).toLocaleDateString()
})

const truncatedContent = computed(() => {
    const content = props.template.content
    return content.length > 100 ? content.substring(0, 100) + '...' : content
})

const editorOptions = [
    [{
        label: 'Edit',
        icon: 'lucide:edit',
        onSelect: () => emit('edit', props.template)
    }],
    [{
        label: 'Delete',
        icon: 'lucide:trash',
        color: 'error' as const,
        onSelect: () => emit('delete', props.template)
    }]
];
</script>

<template>
    <UCard class="group hover:shadow-lg transition-all duration-300 cursor-pointer h-full"
        @click="emit('view', template)">
        <template #header>
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                    <div class="p-2 rounded-lg" :class="`bg-${typeColors[template.type]}/10`">
                        <Icon :name="typeIcons[template.type] || 'lucide:file'" class="size-5"
                            :class="`text-${typeColors[template.type]}`" />
                    </div>
                    <div>
                        <h3 class="font-semibold text-sm line-clamp-1">{{ template.title }}</h3>
                        <p class="text-xs text-muted-foreground">{{ formattedDate }}</p>
                    </div>
                </div>

                <UDropdownMenu :items="editorOptions" @click.stop>
                    <UButton icon="lucide:more-vertical" variant="ghost" size="xs"
                        class="opacity-0 group-hover:opacity-100 transition-opacity" @click.stop />
                </UDropdownMenu>
            </div>
        </template>

        <template #default>
            <p class="text-sm text-muted-foreground line-clamp-3">
                {{ truncatedContent }}
            </p>
        </template>

        <template #footer>
            <div class="flex items-center justify-between">
                <UBadge :color="template.isPublic ? 'success' : 'neutral'" variant="subtle" size="xs">
                    {{ template.isPublic ? 'Public' : 'Private' }}
                </UBadge>
                <UBadge variant="outline" size="xs">
                    {{ template.type }}
                </UBadge>
            </div>
        </template>
    </UCard>
</template>
<style scoped></style>
