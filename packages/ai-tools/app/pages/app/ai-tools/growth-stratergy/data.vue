<!--  Translation file -->
<i18n src="./data.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Data Beats Opinion — Algorithmic diagnostics and feedback dashboard for content performance.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const { t } = useI18n()

const stats = reactive({
    views: 1200,
    ctr: 1.5,
    watchTime: 25,
    engagement: 0.8,
})

const fastOptions = computed(() => {
    const options: { color: 'warning' | 'success'; metric: string; action: string; icon: string }[] = []

    if (stats.ctr < 2) {
        options.push({
            color: 'warning',
            metric: t('alerts.lowCtr'),
            action: t('alerts.lowCtrAction'),
            icon: 'i-lucide-alert-triangle'
        })
    }
    if (stats.watchTime < 30) {
        options.push({
            color: 'warning',
            metric: t('alerts.lowRetention'),
            action: t('alerts.lowRetentionAction'),
            icon: 'i-lucide-clock'
        })
    }
    if (stats.engagement < 1) {
        options.push({
            color: 'warning',
            metric: t('alerts.lowEngagement'),
            action: t('alerts.lowEngagementAction'),
            icon: 'i-lucide-message-square'
        })
    }
    if (options.length === 0) {
        options.push({
            color: 'success',
            metric: t('alerts.onTrack'),
            action: t('alerts.onTrackAction'),
            icon: 'i-lucide-check-circle'
        })
    }

    return options
})

const metricDefinitions = computed(() => [
    { key: 'views' as const, label: t('metrics.views'), step: 1, type: 'number' as const, icon: 'i-lucide-eye' },
    { key: 'ctr' as const, label: t('metrics.ctr'), step: 0.1, type: 'number' as const, icon: 'i-lucide-mouse-pointer-2' },
    { key: 'watchTime' as const, label: t('metrics.watchTime'), step: 1, type: 'number' as const, icon: 'i-lucide-play-circle' },
    { key: 'engagement' as const, label: t('metrics.engagement'), step: 0.1, type: 'number' as const, icon: 'i-lucide-heart' },
])

useHead({
    title: t('title'),
    meta: [
        { name: 'description', content: t('subtitle') }
    ]
})
</script>

<template>
    <div class="container mx-auto py-6 space-y-8">
        <BasePageHeader :title="t('title')" :description="t('subtitle')" />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="space-y-6">
                <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ t('metrics.title') }}
                </h2>
                <UCard>
                    <div class="space-y-5">
                        <div v-for="metric in metricDefinitions" :key="metric.key" class="space-y-2">
                            <div class="flex items-center gap-2">
                                <UIcon :name="metric.icon" class="text-neutral-400" />
                                <label class="block text-xs font-mono text-muted-foreground uppercase">{{ metric.label
                                    }}</label>
                            </div>
                            <UInput v-model.number="stats[metric.key]" :type="metric.type" :step="metric.step" block
                                variant="subtle" class="font-mono" />
                        </div>
                    </div>
                </UCard>
            </div>

            <div class="lg:col-span-2 space-y-6">
                <h2 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ t('diagnostics.title')
                    }}</h2>

                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <UCard v-for="metric in metricDefinitions" :key="metric.key" class="text-center overflow-hidden">
                        <p class="text-[10px] font-mono text-muted-foreground uppercase mb-1">{{ metric.label }}</p>
                        <p class="text-2xl font-black font-mono tabular-nums text-primary">
                            {{ metric.key === 'views' ? stats[metric.key].toLocaleString() : stats[metric.key] + '%' }}
                        </p>
                    </UCard>
                </div>

                <div class="space-y-4">
                    <TransitionGroup name="list">
                        <UAlert v-for="(option, idx) in fastOptions" :key="idx" :icon="option.icon"
                            :color="option.color" variant="soft" :title="option.metric"
                            class="border border-current/10">
                            <template #description>
                                <div class="mt-1 flex items-center gap-2">
                                    <span class="text-[10px] font-mono uppercase opacity-70">{{
                                        t('diagnostics.fastOption') }}</span>
                                    <span class="text-sm font-medium">{{ option.action }}</span>
                                </div>
                            </template>
                        </UAlert>
                    </TransitionGroup>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
    transition: all 0.4s ease;
}

.list-enter-from,
.list-leave-to {
    opacity: 0;
    transform: translateX(20px);
}
</style>
