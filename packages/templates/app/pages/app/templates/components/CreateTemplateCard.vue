<script lang="ts" setup>
/**
 *
 * Component Description: Create Template Card - Trigger card to open the create template modal
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

defineProps<{
  type?: TemplateTypeValue
}>()

const emit = defineEmits<{
  create: []
}>()

const { t } = useI18n()
</script>

<template>
  <UCard
    class="group hover:shadow-lg hover:border-primary/50 transition-all duration-300 cursor-pointer h-full min-h-[180px] flex flex-col justify-center items-center border-0"
    @click="emit('create')">
    <template #default>
      <div class="flex flex-col items-center justify-center gap-4 py-6">
        <div class="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon name="lucide:plus" class="size-8 text-primary group-hover:scale-110 transition-transform" />
        </div>
        <div class="text-center">
          <h3 class="font-semibold text-lg text-primary">
            {{ t('create_template') }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ t('click_to_create') }}
          </p>
        </div>
      </div>
    </template>
  </UCard>
</template>

<i18n>
{
  "en": {
    "create_template": "Create New Template",
    "click_to_create": "Click to create a new template"
  },
  "es": {
    "create_template": "Crear Nueva Plantilla",
    "click_to_create": "Haz clic para crear una nueva plantilla"
  },
  "de": {
    "create_template": "Neue Vorlage erstellen",
    "click_to_create": "Klicken Sie, um eine neue Vorlage zu erstellen"
  },
  "fr": {
    "create_template": "Créer un Nouveau Modèle",
    "click_to_create": "Cliquez pour créer un nouveau modèle"
  }
}
</i18n>

<style scoped></style>
