<i18n src="#site/app/pages/app/business/business.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Team members surface for a business.
 * Members + pending invitations from the better-auth organization plugin,
 * with search, a role filter, role changes, removal, and invitations
 * (one at a time or a batch of emails with copyable accept links).
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection'

const props = defineProps<{
  businessId: string
  businessName?: string
}>()

const { t } = useI18n()
const toast = useToast()
const { user } = UseUser()

interface Member {
  id: string
  userId: string
  role: string
  createdAt?: string
  user?: { id: string, name: string | null, email: string, image: string | null }
}

interface Invitation {
  id: string
  email: string
  role: string | null
  status: string
  createdAt?: string
  acceptUrl: string
}

type Role = 'owner' | 'admin' | 'member'

type RosterRow = {
  key: string
  kind: 'member' | 'invitation'
  id: string
  userId?: string
  name: string
  email: string
  image?: string
  role: Role
  invited: boolean
  createdAt?: string
  acceptUrl?: string
}

const AVATAR_COLORS = ['bg-violet-600', 'bg-emerald-600', 'bg-orange-600', 'bg-sky-600', 'bg-pink-600', 'bg-amber-600']

const members = ref<Member[]>([])
const invitations = ref<Invitation[]>([])
const isLoading = ref(true)
const busyId = ref<string | null>(null)

const inviteModalOpen = ref(false)
const inviteMode = ref<'single' | 'bulk'>('single')
const inviteEmail = ref('')
const inviteEmails = ref('')
const inviteRole = ref<string>('member')
const sending = ref(false)
const sentLinks = ref<{ email: string, acceptUrl: string }[]>([])

// Only owner / member are assignable. `admin` is never offered here — platform
// admins are created from /app/admin/users.
const roleOptions = computed<{ value: string, label: string }[]>(() => [
  { value: 'owner', label: t('team.roleOwner') },
  { value: 'member', label: t('team.roleMember') },
])

const avatarColor = (name: string): string => AVATAR_COLORS[name.length % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
const initialOf = (name: string): string => name.charAt(0).toUpperCase() || '?'
const formatDate = (value?: string): string => (value ? new Date(value).toLocaleDateString() : '—')

const currentMember = computed(() => members.value.find(member => member.userId === user.value?.id))
const canManage = computed(() => ['owner', 'admin'].includes(currentMember.value?.role ?? ''))
const isSelf = (row: RosterRow): boolean => Boolean(row.userId && row.userId === user.value?.id)

const roster = computed<RosterRow[]>(() => [
  ...members.value.map((member): RosterRow => ({
    key: `member-${member.id}`,
    kind: 'member',
    id: member.id,
    userId: member.userId,
    name: member.user?.name || member.user?.email || '',
    email: member.user?.email || '',
    image: member.user?.image ?? undefined,
    role: (member.role as Role) ?? 'member',
    invited: false,
    createdAt: member.createdAt,
  })),
  ...invitations.value.map((invitation): RosterRow => ({
    key: `invitation-${invitation.id}`,
    kind: 'invitation',
    id: invitation.id,
    name: invitation.email,
    email: invitation.email,
    role: (invitation.role as Role) ?? 'member',
    invited: true,
    createdAt: invitation.createdAt,
    acceptUrl: invitation.acceptUrl,
  })),
])

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<RosterRow>({
  key: 'business-team-members',
  modes: ['table', 'list'],
  defaultView: 'table',
  rows: roster,
  searchFields: row => [row.name, row.email],
  filterFns: {
    role: (row, value) => row.role === value,
  },
})

const roleFilterOptions = computed(() => [
  { value: 'all', label: t('team.roleAll') },
  { value: 'owner', label: t('team.roleOwner') },
  { value: 'member', label: t('team.roleMember') },
])

const viewOptions = computed(() => [
  { value: 'table', label: t('team.viewTable'), icon: 'i-lucide-table' },
  { value: 'list', label: t('team.viewList'), icon: 'i-lucide-list' },
])

const toolbarFilters = computed(() => [
  {
    key: 'role',
    label: t('team.columns.role'),
    value: filters.value.role || 'all',
    options: roleFilterOptions.value,
    width: 'w-full sm:w-36',
  },
])

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'member', label: t('team.columns.member') },
  { key: 'role', label: t('team.columns.role') },
  { key: 'status', label: t('team.columns.status'), hideBelow: 'sm' },
  { key: 'added', label: t('team.columns.added'), hideBelow: 'md' },
])

const rowKey = (row: RosterRow): string => row.key

const subtitle = computed(() =>
  t('team.subtitle', {
    count: members.value.length,
    business: props.businessName || '',
    pending: invitations.value.length,
  }),
)

const canRemove = (row: RosterRow): boolean => row.kind === 'member' && canManage.value && row.role !== 'owner' && row.role !== 'admin' && !isSelf(row)
// Admins and owners cannot be re-roled here: admin membership is managed in the
// admin area, and ownership transfer is not a team action.
const canChangeRole = (row: RosterRow): boolean => row.kind === 'member' && canManage.value && row.role === 'member'
const showRowMenu = (row: RosterRow): boolean => row.kind === 'invitation' || canRemove(row)

function handleViewChange(next: string) {
  setView(next)
}

function handleFilterChange(key: string, value: string) {
  setFilter(key, value)
}

function handleSearchChange(value: string) {
  setSearch(value)
}

async function loadTeam() {
  isLoading.value = true
  try {
    const data = await $fetch<{ members: Member[], invitations: Invitation[] }>(`/api/v1/business/${props.businessId}/members`)
    members.value = data.members ?? []
    invitations.value = data.invitations ?? []
  }
  catch {
    toast.add({ title: t('states.error'), description: t('states.something_went_wrong'), color: 'error' })
  }
  finally {
    isLoading.value = false
  }
}

onMounted(loadTeam)

function extractError(error: unknown): string {
  const e = error as { data?: { message?: string }, message?: string }
  return e?.data?.message || e?.message || t('states.something_went_wrong')
}

async function changeRole(row: RosterRow, role: string) {
  busyId.value = row.id
  try {
    await $fetch(`/api/v1/business/${props.businessId}/members/${row.id}`, { method: 'PATCH', body: { role } })
    toast.add({ title: t('team.roleUpdated'), color: 'success' })
    await loadTeam()
  }
  catch (error) {
    toast.add({ title: t('states.error'), description: extractError(error), color: 'error' })
  }
  finally {
    busyId.value = null
  }
}

function handleRoleChange(row: RosterRow, value: string) {
  void changeRole(row, value)
}

async function removeMember(row: RosterRow) {
  busyId.value = row.id
  try {
    await $fetch(`/api/v1/business/${props.businessId}/members/${row.id}`, { method: 'DELETE' })
    toast.add({ title: t('team.removed'), description: row.name, color: 'success' })
    await loadTeam()
  }
  catch (error) {
    toast.add({ title: t('states.error'), description: extractError(error), color: 'error' })
  }
  finally {
    busyId.value = null
  }
}

async function cancelInvitation(row: RosterRow) {
  busyId.value = row.id
  try {
    await $fetch(`/api/v1/business/${props.businessId}/invitations/${row.id}`, { method: 'DELETE' })
    toast.add({ title: t('team.invitationCanceled'), color: 'success' })
    await loadTeam()
  }
  catch (error) {
    toast.add({ title: t('states.error'), description: extractError(error), color: 'error' })
  }
  finally {
    busyId.value = null
  }
}

function confirmRemove(row: RosterRow) {
  toast.add({
    title: t('team.confirmRemoveTitle', { name: row.name }),
    description: t('team.confirmRemoveDescription'),
    color: 'error',
    actions: [
      { label: t('team.remove'), color: 'error', variant: 'solid', onClick: () => removeMember(row) },
      { label: t('form.cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}

async function copyLink(url?: string) {
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: t('team.copied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('team.copyFailed'), description: url, color: 'warning' })
  }
}

const handleCopyInvitationLink = (row: RosterRow) => copyLink(row.acceptUrl)
const handleCopySentLink = (link: { email: string, acceptUrl: string }) => copyLink(link.acceptUrl)

const rowMenuItems = (row: RosterRow) => {
  if (row.kind === 'invitation') {
    return [[
      { label: t('team.copyLink'), icon: 'i-lucide-link', onSelect: () => handleCopyInvitationLink(row) },
      { label: t('team.cancelInvitation'), icon: 'i-lucide-x', color: 'error' as const, onSelect: () => cancelInvitation(row) },
    ]]
  }
  return [[
    { label: t('team.remove'), icon: 'i-lucide-user-minus', color: 'error' as const, onSelect: () => confirmRemove(row) },
  ]]
}

const setInviteMode = (mode: 'single' | 'bulk') => {
  inviteMode.value = mode
}

const closeInviteModal = () => {
  inviteModalOpen.value = false
}

function openInviteModal() {
  inviteMode.value = 'single'
  inviteEmail.value = ''
  inviteEmails.value = ''
  inviteRole.value = 'member'
  sentLinks.value = []
  inviteModalOpen.value = true
}

function parsedEmails(): string[] {
  if (inviteMode.value === 'single') return inviteEmail.value.trim() ? [inviteEmail.value.trim()] : []
  return inviteEmails.value
    .split(/[\s,;\n]+/)
    .map(value => value.trim())
    .filter(Boolean)
}

async function sendInvites() {
  const emails = parsedEmails()
  if (!emails.length) return

  sending.value = true
  try {
    const response = await $fetch<{ invitations: { email: string, acceptUrl: string }[] }>(
      `/api/v1/business/${props.businessId}/invite`,
      { method: 'POST', body: { emails, role: inviteRole.value } },
    )
    sentLinks.value = response.invitations ?? []
    toast.add({ title: t('team.invited'), description: t('team.invitedCount', { count: sentLinks.value.length }), color: 'success' })
    await loadTeam()
  }
  catch (error) {
    toast.add({ title: t('states.error'), description: extractError(error), color: 'error' })
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <UCard>
    <!-- Header -->
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">{{ t('team.membersTitle') }}</h2>
          <p v-if="!isLoading" class="mt-0.5 text-sm text-muted">{{ subtitle }}</p>
        </div>
        <UButton color="primary" icon="i-lucide-user-plus" :label="t('team.inviteMember')" @click="openInviteModal" />
      </div>
    </template>

    <div class="space-y-4">
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('team.search')"
        :filters="toolbarFilters"
        :view="view"
        :views="viewOptions"
        :busy="isLoading"
        @update:search="handleSearchChange"
        @update:filter="handleFilterChange"
        @update:view="handleViewChange"
      />

      <BaseDataTable
        v-if="view === 'table'"
        :rows="filtered"
        :columns="columns"
        :row-key="rowKey"
        :loading="isLoading"
        min-width="44rem"
      >
        <template #cell-member="{ row }">
          <div class="flex items-center gap-3">
            <UAvatar v-if="row.image" :src="row.image" :alt="row.name" size="sm" class="shrink-0" />
            <span
              v-else
              class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              :class="avatarColor(row.name)"
            >{{ initialOf(row.name) }}</span>
            <div class="min-w-0">
              <p class="truncate font-medium text-highlighted">
                {{ row.name }}
                <span v-if="isSelf(row)" class="text-muted">{{ t('team.you') }}</span>
              </p>
              <p class="truncate text-xs text-muted">{{ row.email }}</p>
            </div>
          </div>
        </template>

        <template #cell-role="{ row }">
          <span v-if="row.role === 'owner'" class="inline-flex items-center gap-1.5 text-default">
            <UIcon name="i-lucide-crown" class="size-4 text-warning" />{{ t('team.roleOwner') }}
          </span>
          <UBadge v-else-if="row.role === 'admin'" color="primary" variant="subtle" size="sm">
            {{ t('team.roleAdmin') }}
          </UBadge>
          <USelect
            v-else-if="canChangeRole(row)"
            :model-value="row.role"
            :items="roleOptions"
            value-key="value"
            label-key="label"
            size="sm"
            class="w-32"
            :disabled="busyId === row.id"
            @update:model-value="(value: string) => handleRoleChange(row, String(value))"
          />
          <span v-else class="capitalize text-muted">{{ row.role }}</span>
        </template>

        <template #cell-status="{ row }">
          <UBadge :color="row.invited ? 'warning' : 'success'" variant="subtle" size="sm">
            {{ row.invited ? t('team.statusInvited') : t('team.statusActive') }}
          </UBadge>
        </template>

        <template #cell-added="{ row }">
          <span class="whitespace-nowrap text-muted">{{ formatDate(row.createdAt) }}</span>
        </template>

        <template #row-actions="{ row }">
          <UDropdownMenu v-if="showRowMenu(row)" :items="rowMenuItems(row)" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="busyId === row.id"
              :aria-label="t('team.actions')"
            />
          </UDropdownMenu>
        </template>

        <template #empty>
          <div class="py-8 text-center">
            <UIcon name="i-lucide-users" class="mx-auto mb-3 size-9 text-dimmed" />
            <p class="font-medium text-highlighted">{{ roster.length ? t('team.noResults') : t('team.empty') }}</p>
            <UButton
              v-if="hasActiveFilters"
              class="mt-3"
              variant="ghost"
              size="sm"
              icon="i-lucide-filter-x"
              :label="t('team.clearFilters')"
              @click="resetFilters"
            />
          </div>
        </template>
      </BaseDataTable>

      <BaseCollectionList
        v-else
        :items="filtered"
        :row-key="rowKey"
        :loading="isLoading"
        empty-icon="i-lucide-users"
        :empty-title="roster.length ? t('team.noResults') : t('team.empty')"
      >
        <template #item="{ item: row }">
          <UAvatar v-if="row.image" :src="row.image" :alt="row.name" size="sm" class="shrink-0" />
          <span
            v-else
            class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            :class="avatarColor(row.name)"
          >{{ initialOf(row.name) }}</span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ row.name }}
              <span v-if="isSelf(row)" class="text-muted">{{ t('team.you') }}</span>
            </p>
            <p class="truncate text-xs text-muted">{{ row.email }}</p>
          </div>

          <UBadge class="hidden shrink-0 sm:inline-flex" :color="row.invited ? 'warning' : 'success'" variant="subtle" size="sm">
            {{ row.invited ? t('team.statusInvited') : t('team.statusActive') }}
          </UBadge>

          <span class="hidden w-24 shrink-0 capitalize text-xs text-muted md:block">{{ row.role }}</span>
          <span class="hidden w-24 shrink-0 text-right text-xs text-muted lg:block">{{ formatDate(row.createdAt) }}</span>

          <UDropdownMenu v-if="showRowMenu(row)" :items="rowMenuItems(row)" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="busyId === row.id"
              :aria-label="t('team.actions')"
            />
          </UDropdownMenu>
        </template>

        <template #empty>
          <UButton
            v-if="hasActiveFilters"
            variant="ghost"
            size="sm"
            icon="i-lucide-filter-x"
            :label="t('team.clearFilters')"
            @click="resetFilters"
          />
        </template>
      </BaseCollectionList>
    </div>

    <!-- Invite modal -->
    <UModal v-model:open="inviteModalOpen" :title="t('team.inviteTitle')" :description="t('team.inviteDescription')">
      <template #body>
        <div class="space-y-4">
          <div class="flex gap-1">
            <UButton
              :variant="inviteMode === 'single' ? 'solid' : 'ghost'"
              color="neutral"
              size="sm"
              :label="t('team.modeSingle')"
              @click="() => setInviteMode('single')"
            />
            <UButton
              :variant="inviteMode === 'bulk' ? 'solid' : 'ghost'"
              color="neutral"
              size="sm"
              :label="t('team.modeBulk')"
              @click="() => setInviteMode('bulk')"
            />
          </div>

          <UFormField v-if="inviteMode === 'single'" :label="t('team.emailLabel')">
            <UInput
              v-model="inviteEmail"
              type="email"
              icon="i-lucide-mail"
              :placeholder="t('team.emailPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField v-else :label="t('team.emailsLabel')" :help="t('team.emailsHelp')">
            <UTextarea v-model="inviteEmails" :rows="5" :placeholder="t('team.emailsPlaceholder')" class="w-full" />
          </UFormField>

          <UFormField :label="t('team.roleLabel')" :help="t('team.roleHelp')">
            <USelect v-model="inviteRole" :items="roleOptions" value-key="value" label-key="label" class="w-40" />
          </UFormField>

          <div v-if="sentLinks.length" class="rounded-xl border border-default p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-dimmed">{{ t('team.linksTitle') }}</p>
            <ul class="space-y-1.5">
              <li v-for="link in sentLinks" :key="link.email" class="flex items-center gap-2 text-sm">
                <span class="min-w-0 flex-1 truncate text-muted">{{ link.email }}</span>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :label="t('team.copy')"
                  @click="handleCopySentLink(link)"
                />
              </li>
            </ul>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :label="t('form.cancel')" @click="closeInviteModal" />
          <UButton
            color="primary"
            :loading="sending"
            :disabled="!parsedEmails().length"
            :label="t('team.sendInvite')"
            @click="sendInvites"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
