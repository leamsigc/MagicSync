<script lang="ts" setup>
import type { SocialMediaComplete } from '#layers/BaseDB/db/schema';
import { computed } from 'vue';

/**
 * Component Description: Horizontal list of social platforms with selection state and validation badges
 */

interface Props {
  accounts: SocialMediaComplete[];
  selectedAccounts: SocialMediaComplete[];
  validationStatus: Record<string, { isValid: boolean; errors: string[]; warnings: string[]; }>;
}

const props = defineProps<Props>();
const emit = defineEmits(['toggle',]);

const handleToggle = (account: SocialMediaComplete) => {
  emit('toggle', account);
};
const isSelected = (account: SocialMediaComplete) => {
  return props.selectedAccounts.some(p => p.id === account.id);
};

const getStatus = (accountId: SocialMediaComplete) => {
  return props.validationStatus[accountId.id] || { isValid: false, errors: [], warnings: [] };
};

const selectedIds = computed(() => props.selectedAccounts.map(acc => acc.id));


</script>

<template>
  <div class="flex gap-2  py-2 overflow-x-auto overflow-y-visible w-full">
    <UPopover v-for="account in accounts" :key="account.id" mode="hover">
      <UChip
        :color="isSelected(account) ? getStatus(account).errors.length > 0 ? 'error' : getStatus(account).warnings.length > 0 ? 'warning' : 'primary' : 'neutral'"
        size="3xl"
        class="relative flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-all duration-200 shrink-0 group"
        :class="[
          isSelected(account)
            ? 'bg-zinc-900 border-zinc-700'
            : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 opacity-60 hover:opacity-100'
        ]" :icon="`logos:${account.platform}`">
        <UAvatar :src='account.entityDetail.details.picture' :alt="account.accountName" @click="handleToggle(account)"
          v-if="account.entityDetail.details.picture" />
        <UButton :icon="`logos:${account.platform}`" color="neutral" variant="ghost" @click="handleToggle(account)"
          v-else />
        <template #content>
          <Icon :name="getStatus(account)?.isValid ? 'heroicons:check' : 'heroicons:x-circle'" />
        </template>
      </UChip>
      <template #content>
        <section
          class="backdrop-blur-xl  rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200">

          <div class="p-3 border-b border-white/5 flex items-center gap-2">
            <Icon :name="`logos:${account.platform}`" class="w-4 h-4" />
            <span class="font-bold text-sm text-zinc-200">{{ account.accountName }}</span>
          </div>

          <div class="p-3 space-y-2">
            <template v-if="selectedIds.includes(account.id)">
              <div class="flex items-center justify-between text-xs">
                <span class="text-zinc-500">Status</span>
                <span class="font-medium" :class="{
                  'text-red-400': !getStatus(account).isValid,
                  'text-yellow-400': getStatus(account).warnings.length > 0 && getStatus(account).isValid,
                  'text-green-400': getStatus(account).isValid && getStatus(account).warnings.length === 0
                }">
                  <template v-if="!getStatus(account).isValid">Issues Found</template>
                  <template v-else-if="getStatus(account).warnings.length > 0">Warnings</template>
                  <template v-else>Ready to Post</template>
                </span>
              </div>

              <div v-if="!getStatus(account).isValid && getStatus(account).errors.length > 0"
                class="bg-red-900/20 border border-red-500/20 rounded-lg p-2 space-y-1">
                <div v-for="(err, i) in getStatus(account).errors" :key="i"
                  class="flex items-start gap-1.5 text-[10px] text-red-200">
                  <Icon name="heroicons:x-circle" class="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{{ err }}</span>
                </div>
              </div>

              <div v-if="getStatus(account).warnings.length > 0"
                class="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-2 space-y-1">
                <div v-for="(warn, i) in getStatus(account).warnings" :key="i"
                  class="flex items-start gap-1.5 text-[10px] text-yellow-200">
                  <Icon name="heroicons:exclamation-triangle" class="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{{ warn }}</span>
                </div>
              </div>

              <div v-if="getStatus(account).isValid && getStatus(account).warnings.length === 0"
                class="text-[10px] text-zinc-500 flex items-center gap-1.5">
                <Icon name="heroicons:check-circle" class="w-3 h-3 text-green-500" />
                Everything looks good!
              </div>
            </template>
            <template v-else>
              <div class="text-xs text-zinc-500 text-center py-2">
                Click to enable {{ account.accountName }}
              </div>
            </template>
          </div>
        </section>
      </template>
    </UPopover>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
