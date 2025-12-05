<!--  Translation file -->
<i18n src="./translations.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Templates Overview Page - Hub for all template types
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const { t } = useI18n()

useHead({
    title: t('seo_title'),
    meta: [
        { name: 'description', content: t('seo_description') }
    ]
})

const templateTypes = [
    {
        type: 'EMAIL',
        icon: 'lucide:mail',
        color: 'primary',
        route: '/app/templates/email',
        titleKey: 'email_templates',
        descKey: 'email_templates_desc'
    },
    {
        type: 'IMAGES',
        icon: 'lucide:image',
        color: 'success',
        route: '/app/templates/images',
        titleKey: 'image_templates',
        descKey: 'image_templates_desc'
    },
    {
        type: 'CHAT',
        icon: 'lucide:message-circle',
        color: 'info',
        route: '/app/templates/chat',
        titleKey: 'chat_templates',
        descKey: 'chat_templates_desc'
    },
    {
        type: 'VARIABLE',
        icon: 'lucide:code',
        color: 'warning',
        route: '/app/templates/variables',
        titleKey: 'variable_templates',
        descKey: 'variable_templates_desc'
    }
]
</script>

<template>
    <div class="container mx-auto py-6 space-y-6">
        <BasePageHeader :title="t('title')" :description="t('description')" />

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <NuxtLink v-for="item in templateTypes" :key="item.type" :to="item.route">
                <UCard
                    class="group hover:shadow-lg hover:border-primary/50 transition-all duration-300 cursor-pointer h-full">
                    <template #header>
                        <div class="flex items-center gap-3">
                            <div class="p-3 rounded-xl group-hover:scale-110 transition-transform"
                                :class="`bg-${item.color}/10`">
                                <Icon :name="item.icon" class="size-6" :class="`text-${item.color}`" />
                            </div>
                            <h3 class="font-semibold">{{ t(item.titleKey) }}</h3>
                        </div>
                    </template>

                    <template #default>
                        <p class="text-sm text-muted-foreground">
                            {{ t(item.descKey) }}
                        </p>
                    </template>

                    <template #footer>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-primary group-hover:underline">
                                {{ t('view_all') }}
                            </span>
                            <Icon name="lucide:arrow-right"
                                class="size-4 text-primary group-hover:translate-x-1 transition-transform" />
                        </div>
                    </template>
                </UCard>
            </NuxtLink>
        </div>
    </div>
</template>
<style scoped></style>
