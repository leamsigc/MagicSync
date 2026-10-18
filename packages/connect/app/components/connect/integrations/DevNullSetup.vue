<!--  Translation file -->
<i18n src="./DevNullSetup.json"></i18n>
<script lang="ts" setup>
import { useConnectionManager } from '../../../composables/connect/integrations/useConnectionManager';
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager';
import { $fetch } from 'ofetch';
import { linkSocial } from '#layers/BaseAuth/lib/auth-client';

const { t } = useI18n();
const toast = useToast();
const { activeBusinessId } = useBusinessManager();

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

const tab = ref<'guided' | 'stored'>('guided');
const confirmed = ref(false);
const generating = ref(false);
const revoking = ref(false);
const storedKeyExists = ref(false);

const githubConnected = ref(false);
const checkingGithub = ref(false);

const checkGithub = async () => {
  checkingGithub.value = true;
  try {
    const accounts = await $fetch<any[]>('/api/v1/accounts');
    githubConnected.value = Array.isArray(accounts) && accounts.some((a) => a.providerId === 'github' || a.platform === 'github');
  } catch {
    githubConnected.value = false;
  } finally {
    checkingGithub.value = false;
  }
};

onMounted(() => { checkGithub(); });

const connectGithub = () => {
  linkSocial({
    provider: 'github',
    callbackURL: '/app/integrations',
  });
};

const generateKey = async () => {
  if (!confirmed.value) return;
  generating.value = true;
  try {
    await $fetch('/api/v1/social-accounts/devnull/setup', {
      method: 'POST',
      body: { businessId: activeBusinessId.value },
    });
    storedKeyExists.value = true;
    toast.add({ title: t('stored.success'), color: 'success', icon: 'i-heroicons-check-circle' });
    isOpen.value = false;
  } catch (e: any) {
    toast.add({ title: t('stored.error', { reason: e?.data?.message || e?.message || 'unknown' }), color: 'error', icon: 'i-heroicons-x-circle' });
  } finally {
    generating.value = false;
  }
};

const revokeKey = async () => {
  revoking.value = true;
  try {
    await $fetch('/api/v1/social-accounts/devnull/revoke', {
      method: 'POST',
      body: { businessId: activeBusinessId.value },
    });
    storedKeyExists.value = false;
    confirmed.value = false;
    toast.add({ title: t('stored.revokeSuccess'), color: 'success', icon: 'i-heroicons-check-circle' });
  } catch (e: any) {
    toast.add({ title: t('stored.error', { reason: e?.data?.message || e?.message || 'unknown' }), color: 'error', icon: 'i-heroicons-x-circle' });
  } finally {
    revoking.value = false;
  }
};
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('title')" size="lg">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">{{ t('subtitle') }}</p>

        <!-- Prerequisites -->
        <div class="rounded-lg border border-border p-4 space-y-2">
          <h3 class="text-sm font-semibold">{{ t('prereq.heading') }}</h3>
          <p class="text-sm text-muted">{{ t('prereq.github') }}</p>
          <p class="text-sm text-muted">{{ t('prereq.devnullAccount') }}</p>
          <UButton
            v-if="!githubConnected"
            size="sm"
            color="primary"
            :loading="checkingGithub"
            @click="connectGithub"
          >
            {{ t('prereq.ctaGithub') }}
          </UButton>
          <UBadge v-else color="success" variant="soft">GitHub connected</UBadge>
        </div>

        <!-- Tabs -->
        <UTabs v-model="tab" :items="[
          { label: t('tabs.guided'), value: 'guided' },
          { label: t('tabs.stored'), value: 'stored' },
        ]" />

        <!-- Guided (Option C) -->
        <div v-if="tab === 'guided'" class="space-y-3">
          <p class="text-sm text-muted">{{ t('guided.intro') }}</p>
          <div class="space-y-2">
            <div>
              <h4 class="text-sm font-semibold">{{ t('guided.step1Title') }}</h4>
              <pre class="text-xs bg-elevated p-2 rounded overflow-x-auto">{{ t('guided.step1Body') }}</pre>
            </div>
            <div>
              <h4 class="text-sm font-semibold">{{ t('guided.step2Title') }}</h4>
              <p class="text-sm text-muted">{{ t('guided.step2Body') }}</p>
            </div>
            <div>
              <h4 class="text-sm font-semibold">{{ t('guided.step3Title') }}</h4>
              <p class="text-sm text-muted">{{ t('guided.step3Body') }}</p>
            </div>
            <div>
              <h4 class="text-sm font-semibold">{{ t('guided.step4Title') }}</h4>
              <p class="text-sm text-muted">{{ t('guided.step4Body') }}</p>
            </div>
          </div>
          <div class="rounded-lg border border-border p-3">
            <h4 class="text-sm font-semibold">{{ t('guided.terminalTitle') }}</h4>
            <pre class="text-xs bg-elevated p-2 rounded overflow-x-auto">{{ t('guided.terminalBody') }}</pre>
          </div>
          <p class="text-xs text-muted italic">{{ t('guided.githubTokenNote') }}</p>
        </div>

        <!-- Stored key (Option A) -->
        <div v-if="tab === 'stored'" class="space-y-3">
          <UAlert color="warning" variant="soft" :title="t('stored.warningTitle')" :description="t('stored.warningBody')" />
          <UCheckbox v-model="confirmed" :label="t('stored.confirmLabel')" />
          <div class="flex gap-2">
            <UButton
              color="primary"
              :disabled="!confirmed || !githubConnected"
              :loading="generating"
              @click="generateKey"
            >
              {{ t('stored.confirmButton') }}
            </UButton>
            <UButton
              v-if="storedKeyExists"
              color="error"
              variant="soft"
              :loading="revoking"
              @click="revokeKey"
            >
              {{ t('stored.revokeButton') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped></style>