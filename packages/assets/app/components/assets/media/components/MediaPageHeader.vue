<!--  Translation file -->
<i18n src="#site/app/pages/app/media/index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Asset Page Header with Navigation and Actions
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */

interface Props {
  selectedAssetsCount: number
  showUploader?: boolean
  showCreateFolder?: boolean
}

interface Emits {
  deleteSelected: []
  uploadAssets: []
  createFolder: []
}

const props = withDefaults(defineProps<Props>(), {
  selectedAssetsCount: 0,
  showUploader: true,
  showCreateFolder: true,
})
const emit = defineEmits<Emits>()
const { t } = useI18n()
</script>

<template>
  <BasePageHeader :title="t('title')" :description="t('description')">

    <template #actions>
      <div class="flex items-center gap-2">
        <UButton v-if="selectedAssetsCount > 0" color="error" variant="solid" @click="emit('deleteSelected')">
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          {{ t('buttons.delete_selected', { count: selectedAssetsCount }) }}
        </UButton>

        <UButton v-if="showCreateFolder" variant="outline" @click="emit('createFolder')">
          <Icon name="lucide:folder-plus" class="mr-2 h-4 w-4" />
          <span class="hidden md:inline">
            {{ t('buttons.new_folder') }}
          </span>
        </UButton>

        <UButton @click="emit('uploadAssets')" v-if="showUploader">
          <Icon name="lucide:upload" class="mr-2 h-4 w-4" />
          <span class="hidden md:inline">
            {{ t('buttons.upload_assets') }}
          </span>
        </UButton>
      </div>
    </template>
  </BasePageHeader>
</template>
