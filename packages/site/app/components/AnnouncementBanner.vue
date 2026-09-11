<i18n src="./AnnouncementBanner.json"></i18n>
<script lang="ts" setup>
interface ActiveAnnouncement {
  id: string
  title: string
  html: string
  publishAt: string
  expiresAt: string | null
}

const { t } = useI18n()
const { user } = UseUser()

const announcement = ref<ActiveAnnouncement | null>(null)
const dismissed = ref(false)

function dismissKey(announcementId: string): string {
  // Per-user dismissal: impersonating (or sharing) a browser must not leak
  // one user's dismissal into another user's session.
  const owner = user.value?.id ?? 'anon'
  return `dismissed-announcement-${owner}-${announcementId}`
}

function handleDismiss() {
  if (!announcement.value) return
  try {
    localStorage.setItem(dismissKey(announcement.value.id), '1')
  } catch {
    // Private-mode storage can throw — dismissal just won't persist.
  }
  dismissed.value = true
}

onMounted(async () => {
  try {
    const data = await $fetch<ActiveAnnouncement | null>('/api/v1/announcements/active')
    if (!data) return
    let wasDismissed = false
    try {
      wasDismissed = localStorage.getItem(dismissKey(data.id)) === '1'
    } catch {
      wasDismissed = false
    }
    if (wasDismissed) return
    announcement.value = data
  } catch {
    announcement.value = null
  }
})
</script>

<template>
  <div v-if="announcement && !dismissed" v-motion-fade-visible-once
    class="rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-5">
    <div class="mb-2 flex items-start gap-3">
      <div class="rounded-lg bg-primary/10 p-2">
        <UIcon name="i-lucide-megaphone" class="size-5 text-primary" />
      </div>
      <p class="min-w-0 flex-1 pt-1 text-base font-semibold tracking-tight">{{ announcement.title }}</p>
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="t('dismiss')"
        @click="handleDismiss" />
    </div>
    <UEditor :model-value="announcement.html" content-type="html" :editable="false"
      class="prose prose-neutral dark:prose-invert max-w-none" />
  </div>
</template>
