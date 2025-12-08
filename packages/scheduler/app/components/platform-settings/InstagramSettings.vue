<script lang="ts" setup>
/**
 *
 * Component Description: Instagram platform settings for managing collaborators
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { InstagramSettings } from '#layers/BaseScheduler/shared/platformSettings';

const settings = defineModel<InstagramSettings>({ required: true });

const addCollaborator = () => {
    if (!settings.value.collaborators) {
        settings.value.collaborators = [];
    }
    settings.value.collaborators.push({ label: '' });
};

const removeCollaborator = (index: number) => {
    settings.value.collaborators?.splice(index, 1);
};
</script>

<template>
    <div class="space-y-4">
        <UFormGroup label="Collaborators" hint="Tag other Instagram accounts as collaborators">
            <div class="space-y-2">
                <div v-for="(collaborator, index) in settings.collaborators" :key="index" class="flex gap-2">
                    <UInput v-model="collaborator.label" placeholder="@username" class="flex-1" />
                    <UButton icon="i-heroicons-trash" color="error" variant="ghost"
                        @click="removeCollaborator(index)" />
                </div>
                <UButton icon="i-heroicons-plus" variant="ghost" size="sm" @click="addCollaborator">
                    Add Collaborator
                </UButton>
            </div>
        </UFormGroup>
    </div>
</template>

<style scoped></style>
