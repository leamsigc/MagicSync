<!-- Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Profile avatar upload and display component
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const { user, client } = UseUser()
const toast = useToast()

const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const handleFileSelect = () => {
  fileInput.value?.click()
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast.add({
      title: 'Invalid file type',
      description: 'Please select an image file',
      color: 'error'
    })
    return
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.add({
      title: 'File too large',
      description: 'Please select an image smaller than 5MB',
      color: 'error'
    })
    return
  }

  loading.value = true

  // Convert to base64 or upload to server
  const reader = new FileReader()
  reader.onload = async (e) => {
    const imageUrl = e.target?.result as string

    try {
      await client.updateUser({ image: imageUrl })
      toast.add({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated',
        color: 'success'
      })
    } catch (err: any) {
      toast.add({
        title: 'Upload failed',
        description: err.message,
        color: 'error'
      })
    } finally {
      loading.value = false
    }
  }
  reader.readAsDataURL(file)
}

const handleRemoveAvatar = async () => {
  loading.value = true
  try {
    await client.updateUser({ image: '' })
    toast.add({
      title: 'Avatar removed',
      description: 'Your profile picture has been removed',
      color: 'success'
    })
  } catch (err: any) {
    toast.add({
      title: 'Failed to remove avatar',
      description: err.message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const getInitials = (name?: string) => {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<template>
  <UCard>
    <div class="flex flex-col items-center space-y-4">
      <!-- Avatar Display -->
      <div class="relative">
        <UAvatar :src="user?.image || undefined" :alt="user?.name || 'User'" size="3xl"
          :ui="{ fallback: 'text-2xl' }" />
      </div>

      <!-- Upload Controls -->
      <div class="flex flex-col gap-2 w-full">
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />

        <UButton variant="outline" block :loading="loading" @click="handleFileSelect">
          {{ user?.image ? t('avatar.change') : t('avatar.upload') }}
        </UButton>

        <UButton v-if="user?.image" variant="ghost" color="error" block :loading="loading" @click="handleRemoveAvatar">
          {{ t('avatar.remove') }}
        </UButton>
      </div>

      <p class="text-xs text-muted-foreground text-center">
        JPG, PNG or GIF. Max size 5MB.
      </p>
    </div>
  </UCard>
</template>

<style scoped></style>
