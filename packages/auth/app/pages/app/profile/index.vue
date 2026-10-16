<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
import AccountSettings from '../../../components/auth/account/components/AccountSettings.vue'
import LinkedAccounts from '../../../components/auth/account/components/LinkedAccounts.vue'
import DangerZone from '../../../components/auth/account/components/DangerZone.vue'
import AiModelSettings from '../../../components/auth/account/components/AiModelSettings.vue'
import ProfileForm from '../../../components/auth/profile/components/ProfileForm.vue'
import ProfileAvatar from '../../../components/auth/profile/components/ProfileAvatar.vue'

/**
 * The single profile view.
 *
 * This used to be two routes — `/app/profile` held the avatar, name and theme,
 * `/app/account` held the email, linked accounts, AI model and danger zone — so
 * there was no one place to look at your own account. The account tab is now a
 * tab here, at `/app/profile`, and `/app/account` is gone.
 *
 * The header and the four-up strip are derived from data the session already
 * carries plus two cheap reads (the business list and the linked accounts), so
 * nothing on this page is a placeholder.
 */

const { t, locale } = useI18n()
const { user, getUserAccountList, listAccounts } = UseUser()
const { businesses, getAllBusinesses } = useBusinessManager()
const toast = useToast()

const roleKey = computed(() => (user.value?.role === 'admin' ? 'admin' : 'user'))

const memberSince = computed(() => {
  const created = user.value?.createdAt
  if (!created) return ''
  return new Date(created).toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
})

const accountCount = computed(() => (Array.isArray(listAccounts.value) ? listAccounts.value.length : 0))
const businessCount = computed(() => businesses.value.pagination?.total ?? 0)

const stats = computed(() => [
  { key: 'businesses', label: t('stats.businesses'), value: String(businessCount.value) },
  { key: 'accounts', label: t('stats.accounts'), value: String(accountCount.value) },
  { key: 'role', label: t('stats.role'), value: t(`header.roles.${roleKey.value}`) },
  { key: 'email', label: t('stats.email'), value: user.value?.emailVerified ? t('header.verified') : t('header.unverified') },
])

const items = computed(() => [
  { label: t('tabs.profile'), slot: 'profile' },
  { label: t('tabs.general'), slot: 'general' },
  { label: t('tabs.linked'), slot: 'linked' },
  { label: t('tabs.ai'), slot: 'ai' },
  { label: t('tabs.danger'), slot: 'danger' },
])

const shortcutLinks = computed(() => [
  { label: t('shortcuts.apiKeys'), icon: 'i-lucide-key', to: '/app/keys' },
  { label: t('shortcuts.notifications'), icon: 'i-lucide-bell', to: '/app/notifications' },
  { label: t('shortcuts.business'), icon: 'i-lucide-building-2', to: '/app/business' },
])

async function handleCopyEmail() {
  try {
    await navigator.clipboard.writeText(user.value?.email ?? '')
    toast.add({ title: t('header.copied'), icon: 'i-lucide-check-circle', color: 'success' })
  }
  catch {
    toast.add({ title: t('header.copyFailed'), icon: 'i-lucide-x-circle', color: 'error' })
  }
}

function handleAiSaved() {
  return undefined
}

onMounted(() => {
  void getAllBusinesses()
  void getUserAccountList()
})

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') },
  ],
})
</script>

<template>
  <UContainer class="max-w-6xl py-8">
    <div v-if="!user" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-12 w-12 animate-spin text-primary" />
    </div>

    <template v-else>
      <section class="overflow-hidden rounded-2xl bg-elevated" data-tour="profile-step-0">
        <div class="h-24 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" aria-hidden="true" />
        <div class="-mt-12 flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <UAvatar
            :src="user.image || undefined"
            :alt="user.name || 'User'"
            size="3xl"
            :ui="{ fallback: 'text-2xl' }"
            class="shrink-0 ring-4 ring-background"
          />
          <div class="min-w-0 flex-1 sm:pb-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-xl font-semibold text-highlighted">
                {{ user.name || 'User' }}
              </h1>
              <UBadge :label="t(`header.roles.${roleKey}`)" variant="subtle" color="neutral" />
            </div>
            <ul class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <li class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-mail" class="size-3.5" />
                {{ user.email }}
              </li>
              <li class="inline-flex items-center gap-1.5">
                <UIcon
                  :name="user.emailVerified ? 'i-lucide-badge-check' : 'i-lucide-circle-alert'"
                  class="size-3.5"
                  :class="user.emailVerified ? 'text-success' : 'text-warning'"
                />
                {{ user.emailVerified ? t('header.verified') : t('header.unverified') }}
              </li>
              <li v-if="memberSince" class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-calendar" class="size-3.5" />
                {{ t('header.memberSince', { date: memberSince }) }}
              </li>
            </ul>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-copy"
              :label="t('header.copyEmail')"
              data-testid="profile-copy-email"
              @click="handleCopyEmail"
            />
          </div>
        </div>
      </section>

      <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="stat in stats" :key="stat.key" class="min-w-0 rounded-2xl bg-elevated p-4">
          <p class="truncate text-xs font-medium tracking-wide text-muted uppercase">
            {{ stat.label }}
          </p>
          <p class="mt-1 truncate text-xl font-bold text-highlighted tabular-nums">
            {{ stat.value }}
          </p>
        </div>
      </section>

      <div class="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <!-- `min-w-0`: a grid item will not shrink below its content, and the
             tab strip's min-content is wider than a phone. -->
        <div class="min-w-0 lg:col-span-2" data-tour="profile-step-1">
          <UTabs :items="items" class="w-full">
            <template #profile>
              <ProfileForm class="mt-4" />
            </template>

            <template #general>
              <AccountSettings class="mt-4" />
            </template>

            <template #linked>
              <LinkedAccounts class="mt-4" />
            </template>

            <template #ai>
              <div v-motion-fade :duration="250">
                <AiModelSettings mode="global" class="mt-4" @saved="handleAiSaved" />
              </div>
            </template>

            <template #danger>
              <DangerZone class="mt-4" />
            </template>
          </UTabs>
        </div>

        <aside class="min-w-0 space-y-6" data-tour="profile-step-2">
          <div class="rounded-2xl bg-elevated p-5">
            <ProfileAvatar />
          </div>

          <div class="rounded-2xl bg-elevated p-5">
            <h2 class="mb-3 text-sm font-semibold text-highlighted">{{ t('shortcuts.title') }}</h2>
            <nav class="space-y-1">
              <NuxtLink
                v-for="link in shortcutLinks"
                :key="link.to"
                :to="link.to"
                class="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-default transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <UIcon :name="link.icon" class="size-4 shrink-0 text-muted" />
                <span class="flex-1">{{ link.label }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
              </NuxtLink>
            </nav>
          </div>
        </aside>
      </div>
    </template>
  </UContainer>
</template>
