<!--  Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import MediaPageHeader from './components/MediaPageHeader.vue'
const { t } = useI18n()
const toast = useToast();
const selectedBusinessId = ref();
const handleFileUpload = async (files: File[]) => {

  toast.add({
    title: t('messages.upload_complete', {
      count: files.length,
      plural: files.length !== 1 ? 's' : ''
    }),
    color: 'success'
  })
  // showUploader.value = false
}
</script>

<template>
  <div class=" p-4 lg:mx-auto lg:p-6">
    <MediaPageHeader :selected-assets-count="0" :show-uploader="false">
      <template #title>
        {{ t('upload.title') }}
      </template>
      <template #description>
        {{ t('upload.description') }}
      </template>
    </MediaPageHeader>
    <MediaUploader :business-id="selectedBusinessId" @upload="handleFileUpload" />
  </div>
</template>
<style scoped></style>
