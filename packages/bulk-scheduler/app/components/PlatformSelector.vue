<!--  Translation file -->
<i18n src="./PlatformSelector.json"></i18n>

<script lang="ts" setup>
import type { SocialMediaComplete } from '#layers/BaseDB/db/schema'
import { computed } from 'vue'

/**
 * Component Description: Horizontal list of social platforms with selection state and validation badges
 * Refactored to match PostPlatformSelector design.
 */

interface Props {
  accounts: SocialMediaComplete[];
  selectedIds: string[];
  validationStatus?: Record<string, { isValid: boolean; errors: string[]; warnings: string[]; }>;
}

const props = withDefaults(defineProps<Props>(), {
  validationStatus: () => ({})
});

const emit = defineEmits<{
  toggle: [account: SocialMediaComplete]
}>()

const handleToggle = (account: SocialMediaComplete) => {
  emit('toggle', account)
}

const isSelected = (accountId: string) => {
  return props.selectedIds.includes(accountId)
}

const getStatus = (accountId: string) => {
  return props.validationStatus?.[accountId] || { isValid: true, errors: [], warnings: [] }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="block text-sm font-medium">
      {{ $t('platformSelector.title') || 'Select Platforms' }}
    </label>

    <div class="flex gap-2 py-2 overflow-x-auto overflow-y-visible w-full scrollbar-hide">
      <UPopover v-for="account in accounts" :key="account.id" mode="hover">
        <UChip
          :color="isSelected(account.id) ? getStatus(account.id).errors.length > 0 ? 'error' : getStatus(account.id).warnings.length > 0 ? 'warning' : 'primary' : 'neutral'"
          size="3xl"
          class="relative flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-all duration-200 shrink-0 group cursor-pointer"
          :class="[
            isSelected(account.id)
              ? 'bg-zinc-900 border-zinc-700'
              : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 opacity-60 hover:opacity-100'
          ]" @click="handleToggle(account)">
          <UAvatar :src="account.entityDetail?.details?.picture" :alt="account.accountName"
            v-if="account.entityDetail?.details?.picture" />
          <UButton :icon="`logos:${account.platform}`" color="neutral" variant="ghost" v-else />

          <template #content v-if="isSelected(account.id)">
            <Icon :name="getStatus(account.id).isValid ? 'heroicons:check' : 'heroicons:x-circle'" class="w-2 h-2" />
          </template>
        </UChip>

        <template #content>
          <section
            class="backdrop-blur-xl rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200 min-w-[200px]">
            <div class="p-3 border-b border-white/5 flex items-center gap-2">
              <Icon :name="`logos:${account.platform}`" class="w-4 h-4" />
              <span class="font-bold text-sm text-zinc-200">{{ account.accountName }}</span>
            </div>

            <div class="p-3 space-y-2">
              <template v-if="isSelected(account.id)">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-zinc-500">Status</span>
                  <span class="font-medium" :class="{
                    'text-red-400': !getStatus(account.id).isValid,
                    'text-yellow-400': getStatus(account.id).warnings.length > 0 && getStatus(account.id).isValid,
                    'text-green-400': getStatus(account.id).isValid && getStatus(account.id).warnings.length === 0
                  }">
                    <template v-if="!getStatus(account.id).isValid">Issues Found</template>
                    <template v-else-if="getStatus(account.id).warnings.length > 0">Warnings</template>
                    <template v-else>Ready to Post</template>
                  </span>
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
