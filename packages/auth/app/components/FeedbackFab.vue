<i18n src="./FeedbackFab.json"></i18n>
<script lang="ts" setup>
const { t } = useI18n()
const toast = useToast()
const { loggedIn } = UseUser()

const showModal = ref(false)
const sending = ref(false)
const category = ref('bug')
const message = ref('')

function categoryItems() {
  return [
    { label: t('categories.bug'), value: 'bug' },
    { label: t('categories.feature'), value: 'feature' },
    { label: t('categories.praise'), value: 'praise' },
    { label: t('categories.other'), value: 'other' }
  ]
}

function openFeedback() {
  category.value = 'bug'
  message.value = ''
  showModal.value = true
}

function closeFeedback() {
  showModal.value = false
}

async function submitFeedback() {
  if (message.value.trim().length < 10) {
    toast.add({ title: t('toast.error'), description: t('toast.messageTooShort'), color: 'error' })
    return
  }
  sending.value = true
  try {
    await $fetch('/api/v1/feedback', {
      method: 'POST',
      body: { category: category.value, message: message.value.trim() }
    })
    toast.add({ title: t('toast.sent'), description: t('toast.sentDescription'), color: 'success' })
    showModal.value = false
    message.value = ''
  } catch {
    toast.add({ title: t('toast.error'), description: t('toast.sendFailed'), color: 'error' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="loggedIn">
    <UButton icon="i-lucide-message-square-heart" color="primary" variant="solid" size="lg" :aria-label="t('openFeedback')"
      class="fixed bottom-24 right-6 z-50 rounded-full shadow-lg" @click="openFeedback" />

    <UModal v-model:open="showModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">{{ t('modal.title') }}</h3>
            <p class="text-sm text-muted-foreground">{{ t('modal.description') }}</p>
          </template>
          <div class="space-y-4">
            <UFormField :label="t('modal.category')">
              <USelect v-model="category" :items="categoryItems()" class="w-full" />
            </UFormField>
            <UFormField :label="t('modal.message')">
              <UTextarea v-model="message" :placeholder="t('modal.messagePlaceholder')" :rows="5" :maxlength="2000"
                class="w-full" />
            </UFormField>
            <p class="text-right text-xs text-muted-foreground">{{ message.length }}/2000</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="closeFeedback">{{ t('modal.cancel') }}</UButton>
              <UButton color="primary" :loading="sending" @click="submitFeedback">{{ t('modal.submit') }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
