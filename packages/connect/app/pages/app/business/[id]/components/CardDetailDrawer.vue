<i18n src="../content.json"></i18n>
<script setup lang="ts">
import dayjs from 'dayjs'
import { ACTION_ICONS, ACTION_I18N, BOARD_ACTIONS, PRIMARY_ACTION, stateColor, type BoardDetail, type BoardItem } from './board-types'

const DRAFT_READY_STATES = ['drafting', 'changes_requested', 'review_required', 'approved', 'materializing', 'ready']

const props = defineProps<{
  detail: BoardDetail | null
  businessId: string
  loading?: boolean
  busyAction?: string | null
}>()

const emit = defineEmits<{
  action: [item: BoardItem, action: string]
  openChat: [item: BoardItem]
  briefSaved: [item: BoardItem]
  improved: [item: BoardItem]
}>()

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const editingBrief = ref(false)
const draftBrief = ref('')
const savingBrief = ref(false)
const activePlatform = ref('')
const fixing = ref<string | null>(null)

const actions = computed(() => props.detail ? (BOARD_ACTIONS[props.detail.item.state] ?? []) : [])
const failingChecks = computed(() => (props.detail?.checks ?? []).filter(check => check.status !== 'pass'))
const showNoDraft = computed(() => !props.detail?.artifact && !!props.detail && DRAFT_READY_STATES.includes(props.detail.item.state))

const primaryAction = computed<string | null>(() => {
  if (!props.detail) return null
  const wanted = PRIMARY_ACTION[props.detail.item.state]
  if (wanted && actions.value.includes(wanted)) return wanted
  return actions.value[0] ?? null
})

const secondaryActions = computed(() => actions.value.filter(action => action !== primaryAction.value))

function actionLabel(action: string): string {
  if (action === 'research' && props.detail && props.detail.item.state !== 'idea') {
    return t('detail.researchAgain')
  }
  return t(`actions.${ACTION_I18N[action]}`)
}

function draftOutput(): Record<string, unknown> {
  const raw = props.detail?.artifact?.output
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    }
    catch {
      return {}
    }
  }
  return {}
}

function draftCaption(): string {
  const caption = draftOutput().caption
  return typeof caption === 'string' ? caption : ''
}

function draftVariantText(variant: unknown): string {
  if (typeof variant === 'string') return variant
  const caption = (variant as { caption?: unknown } | null)?.caption
  return typeof caption === 'string' ? caption : ''
}

function draftVariants(): Record<string, string> {
  const variants = draftOutput().platformVariants
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return {}
  const record: Record<string, string> = {}
  for (const [platform, variant] of Object.entries(variants)) {
    const text = draftVariantText(variant)
    if (text) record[platform] = text
  }
  return record
}

function draftVariantNames(): string[] {
  return Object.keys(draftVariants())
}

function draftCta(): string {
  const cta = draftOutput().cta
  return typeof cta === 'string' ? cta : ''
}

const shownCaption = computed(() => {
  if (!activePlatform.value) return draftCaption()
  return draftVariants()[activePlatform.value] ?? draftCaption()
})

function handleOpenChange(value: boolean) {
  open.value = value
}

function handleAction(action: string) {
  if (props.detail) emit('action', props.detail.item, action)
}

function handleSelectPlatform(platform: string) {
  activePlatform.value = platform
}

function handleFixAll() {
  void handleFix(null)
}

async function handleFix(kind: string | null) {
  if (!props.detail || fixing.value) return
  fixing.value = kind ?? 'all'
  try {
    const response = await $fetch<{ item: BoardItem }>(`/api/v1/content-items/${props.detail.item.id}/actions`, {
      method: 'POST',
      body: {
        businessId: props.businessId,
        action: 'improve',
        ...(kind ? { feedback: t('detail.fixFeedback', { kind }) } : {}),
      },
    })
    activePlatform.value = ''
    emit('improved', response.item)
    toast.add({ title: t('feedback.improved'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('feedback.actionFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    fixing.value = null
  }
}

function errorMessage(error: unknown): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } } | null)?.data
  return data?.statusMessage || data?.message || (error instanceof Error ? error.message : String(error))
}

function handleStartEditBrief() {
  draftBrief.value = props.detail?.item.brief ?? ''
  editingBrief.value = true
}

function handleCancelEditBrief() {
  editingBrief.value = false
}

async function handleSaveBrief() {
  if (!props.detail) return
  savingBrief.value = true
  try {
    const response = await $fetch<{ item: BoardItem }>(`/api/v1/content-items/${props.detail.item.id}`, {
      method: 'PUT',
      body: { businessId: props.businessId, brief: draftBrief.value },
    })
    editingBrief.value = false
    emit('briefSaved', response.item)
    toast.add({ title: t('feedback.briefSaved'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('feedback.briefFailed', { error: errorMessage(error) }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    savingBrief.value = false
  }
}

function formatDate(value: string | null | undefined) {
  return value ? dayjs(value).format('MMM D, YYYY HH:mm') : ''
}

watch(() => props.detail?.artifact?.id, () => {
  activePlatform.value = ''
})
</script>

<template>
  <UDrawer :open="open" :title="t('detail.title')" @update:open="handleOpenChange">
    <template #body>
      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin" />
      </div>
      <div v-else-if="detail" class="space-y-4">
        <!-- Header: state, platforms, title, meta -->
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge :color="stateColor(detail.item.state)" variant="subtle" size="sm">
              {{ t(`states.${detail.item.state}`) }}
            </UBadge>
            <UBadge
              v-for="platform in detail.item.platforms ?? []"
              :key="platform"
              color="neutral"
              variant="outline"
              size="sm"
            >
              {{ platform }}
            </UBadge>
          </div>
          <h3 class="text-lg font-semibold">{{ detail.item.title }}</h3>
          <p class="text-xs text-muted">
            {{ t('detail.createdAt') }} {{ formatDate(detail.item.createdAt) }} · {{ t('detail.updatedAt') }} {{ formatDate(detail.item.updatedAt) }}
          </p>
        </div>

        <!-- Next step: primary action + overflow menu + chat -->
        <section v-if="primaryAction" class="rounded-xl border border-primary/20 bg-primary/5 p-4" v-motion-fade :duration="200">
          <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-primary/70">{{ t('detail.primary') }}</h4>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="lg"
              :icon="ACTION_ICONS[primaryAction]"
              color="primary"
              variant="solid"
              :loading="busyAction === primaryAction"
              :data-testid="`board-action-${primaryAction}`"
              @click="handleAction(primaryAction)"
            >
              {{ actionLabel(primaryAction) }}
            </UButton>
            <UDropdownMenu
              v-if="secondaryActions.length > 0"
              :items="secondaryActions.map(action => ({
                label: actionLabel(action),
                icon: ACTION_ICONS[action],
                onSelect: () => handleAction(action),
                disabled: busyAction !== null,
              }))"
            >
              <UButton size="lg" color="neutral" variant="outline" icon="i-heroicons-ellipsis-horizontal" />
            </UDropdownMenu>
            <UButton size="lg" color="neutral" variant="ghost" icon="i-heroicons-chat-bubble-left-right" :title="t('actions.openChat')" @click="emit('openChat', detail.item)" />
          </div>
        </section>

        <!-- Brief -->
        <UCard v-motion-fade :duration="200">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-sm font-semibold">{{ t('detail.brief') }}</h4>
              <UButton
                v-if="!editingBrief && detail.item.brief"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-heroicons-pencil"
                @click="handleStartEditBrief"
              >
                {{ t('detail.editBrief') }}
              </UButton>
            </div>
          </template>
          <div v-if="!editingBrief" class="space-y-2">
            <UEditor
              v-if="detail.item.brief"
              :model-value="detail.item.brief"
              :editable="false"
              content-type="markdown"
              class="w-full"
            />
            <p v-else class="text-xs text-muted">{{ t('detail.noDraft') }}</p>
          </div>
          <div v-else class="space-y-2">
            <UEditor v-model="draftBrief" content-type="markdown" class="w-full" data-testid="board-brief-editor" />
            <div class="flex gap-2">
              <UButton size="xs" color="primary" :loading="savingBrief" data-testid="board-brief-save" @click="handleSaveBrief">
                {{ t('detail.save') }}
              </UButton>
              <UButton size="xs" variant="ghost" color="neutral" @click="handleCancelEditBrief">
                {{ t('actions.cancel') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Draft -->
        <UCard v-if="detail.artifact" v-motion-fade :duration="200">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-sm font-semibold">{{ t('detail.draft') }}</h4>
              <UBadge :color="stateColor(detail.artifact.status)" variant="subtle" size="xs">
                v{{ detail.artifact.version }} · {{ detail.artifact.status }}
              </UBadge>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-heroicons-document-text"
                class="ms-auto"
                @click="emit('openChat', detail.item)"
              >
                {{ t('detail.viewArtifact') }}
              </UButton>
            </div>
          </template>
          <div v-if="draftVariantNames().length > 0" class="mb-3 flex flex-wrap gap-1">
            <UButton
              size="xs"
              :variant="activePlatform === '' ? 'solid' : 'outline'"
              color="neutral"
              @click="handleSelectPlatform('')"
            >
              {{ t('detail.mainPost') }}
            </UButton>
            <UButton
              v-for="platform in draftVariantNames()"
              :key="platform"
              size="xs"
              :variant="activePlatform === platform ? 'solid' : 'outline'"
              color="neutral"
              @click="handleSelectPlatform(platform)"
            >
              {{ platform }}
            </UButton>
          </div>
          <p class="whitespace-pre-wrap rounded-xl bg-elevated p-3 text-sm">{{ shownCaption }}</p>
          <p v-if="draftCta()" class="mt-2 text-xs text-muted">{{ t('detail.ctaLabel') }}: {{ draftCta() }}</p>
        </UCard>
        <p v-else-if="showNoDraft" class="text-xs text-muted">{{ t('detail.noDraft') }}</p>

        <!-- Checks -->
        <UCard v-motion-fade :duration="200">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h4 class="text-sm font-semibold">{{ t('detail.checks') }}</h4>
              <UButton
                v-if="failingChecks.length > 0"
                size="xs"
                variant="outline"
                color="neutral"
                icon="i-heroicons-wrench-screwdriver"
                :loading="fixing === 'all'"
                @click="handleFixAll"
              >
                {{ t('detail.fixAll') }}
              </UButton>
            </div>
          </template>
          <p v-if="detail.checks.length === 0" class="text-xs text-muted">{{ t('detail.noChecks') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="check in detail.checks" :key="check.id" class="flex items-center gap-2 text-xs">
              <UBadge
                :color="check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warning' : 'error'"
                variant="subtle"
                size="xs"
              >
                {{ check.kind }}
              </UBadge>
              <span>{{ check.score ?? '—' }}</span>
              <UButton
                v-if="check.status !== 'pass'"
                size="xs"
                variant="ghost"
                color="neutral"
                class="ms-auto"
                :loading="fixing === check.kind"
                @click="handleFix(check.kind)"
              >
                {{ t('detail.fix') }}
              </UButton>
            </li>
          </ul>
        </UCard>

        <!-- Timeline -->
        <UCard v-motion-fade :duration="200">
          <template #header>
            <h4 class="text-sm font-semibold">{{ t('detail.timeline') }}</h4>
          </template>
          <p v-if="detail.events.length === 0" class="text-xs text-muted">{{ t('detail.noEvents') }}</p>
          <ol v-else class="space-y-2">
            <li v-for="event in detail.events" :key="event.id" class="flex items-start gap-2 text-xs">
              <UIcon name="i-heroicons-clock" class="mt-0.5 size-3.5 text-muted" />
              <div>
                <p>
                  <span class="font-medium">{{ event.event }}</span>
                  <span v-if="event.toState" class="text-muted"> · {{ t(`states.${event.toState}`) }}</span>
                </p>
                <p class="text-muted">{{ formatDate(event.createdAt) }} · {{ event.actorKind }}</p>
              </div>
            </li>
          </ol>
        </UCard>
      </div>
    </template>
  </UDrawer>
</template>
