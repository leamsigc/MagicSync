<script setup lang="ts">
/**
 * Component Description: Account Selection step component
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()
const { connectedSocialAccountsList } = useSocialMediaManager()

const selectedAccounts = defineModel<string[]>('selectedAccounts', { required: true })
const emit = defineEmits(['next', 'back', 'generate'])

// Wrapper to call generate before next
const handleNext = () => {
    emit('generate')
    emit('next')
}
</script>

<template>
    <div class="space-y-6">
        <div v-if="connectedSocialAccountsList.length === 0" class="text-center py-8 text-gray-500">
            <UIcon name="i-heroicons-exclamation-circle" class="w-12 h-12 mb-2 mx-auto" />
            <p>{{ t('accounts.noAccounts') }}</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="account in connectedSocialAccountsList" :key="account.id"
                class="border dark:border-gray-700 rounded-lg p-4 cursor-pointer flex items-center space-x-3 transition-colors"
                :class="{ 'ring-2 ring-primary bg-primary-50 dark:bg-primary-900/10': selectedAccounts.includes(account.id), 'hover:bg-gray-50 dark:hover:bg-gray-800': !selectedAccounts.includes(account.id) }"
                @click="selectedAccounts.includes(account.id) ? selectedAccounts = selectedAccounts.filter((id: string) => id !== account.id) : selectedAccounts.push(account.id)">
                <div class="flex-shrink-0">
                    <UCheckbox :model-value="selectedAccounts.includes(account.id)"
                        @change="selectedAccounts.includes(account.id) ? selectedAccounts = selectedAccounts.filter((id: string) => id !== account.id) : selectedAccounts.push(account.id)" />
                </div>
                <div class="flex-1">
                    <div class="font-medium">{{ account.name }}</div>
                    <div class="text-xs text-gray-500 capitalize">{{ account.platform }}</div>
                </div>
            </div>
        </div>

        <div class="flex justify-between mt-6">
            <UButton color="gray" variant="ghost" icon="i-heroicons-arrow-left" @click="$emit('back')">{{
                t('config.backBtn') }}</UButton>
            <UButton @click="handleNext" :disabled="selectedAccounts.length === 0"
                trailing-icon="i-heroicons-arrow-right">{{ t('accounts.nextBtn') }}</UButton>
        </div>
    </div>
</template>
