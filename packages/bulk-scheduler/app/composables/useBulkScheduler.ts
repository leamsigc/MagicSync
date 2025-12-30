import { ref } from 'vue'
import type { Ref } from 'vue'

export interface PostItem {
    content: string
    image?: string
}

export const useBulkScheduler = () => {
    const { t } = useI18n()
    const toast = useToast()
    const { connectedSocialAccountsList } = useSocialMediaManager()

    const currentStep = ref(0)
    const parsedPosts = ref<PostItem[]>([])
    const config = ref({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        postsPerDay: 1,
        defaultTime: '09:00'
    })
    const selectedAccounts = ref<string[]>([])
    const scheduledPosts = ref<any[]>([])
    const isScheduling = ref(false)

    // Derived state could be here or in components, but centralizing schedule generation is good?
    // Actually generateSchedule depends on config and parsedPosts.

    const generateSchedule = () => {
        const posts = []
        let currentDate = new Date(config.value.startDate + 'T' + config.value.defaultTime)
        let postsAddedToday = 0

        for (const post of parsedPosts.value) {
            if (postsAddedToday >= config.value.postsPerDay) {
                currentDate.setDate(currentDate.getDate() + 1)
                postsAddedToday = 0
            }

            posts.push({
                content: post.content,
                mediaAssets: post.image ? [post.image] : [],
                scheduledAt: new Date(currentDate),
                targetPlatforms: selectedAccounts.value
            })
            postsAddedToday++
        }
        scheduledPosts.value = posts
        // Auto advance is usually UI logic, but we can return success
        return true
    }

    const schedulePosts = async () => {
        isScheduling.value = true
        try {
            const account = connectedSocialAccountsList.value.find(a => selectedAccounts.value.includes(a.id))
            const businessId = account?.businessId

            if (!businessId) {
                toast.add({ title: 'Error', description: t('errors.noBusinessId'), color: 'red' })
                return false
            }

            const postsToCreate = scheduledPosts.value.map(post => ({
                businessId,
                content: post.content,
                targetPlatforms: post.targetPlatforms,
                scheduledAt: post.scheduledAt,
                mediaAssets: post.mediaAssets
            }))

            const { data, errors } = await $fetch<{ data: any, errors: any }>('/api/v1/posts/bulk', {
                method: 'POST',
                body: {
                    posts: postsToCreate
                }
            })

            if (errors && errors.length > 0) {
                toast.add({ title: 'Partial Success', description: `Some posts failed to schedule`, color: 'orange' })
            } else {
                toast.add({ title: 'Success', description: t('errors.success'), color: 'green' })
            }
            return true
        } catch (e) {
            console.error(e)
            toast.add({ title: 'Error', description: t('errors.scheduleError'), color: 'red' })
            return false
        } finally {
            isScheduling.value = false
        }
    }

    // Reset state
    const reset = () => {
        currentStep.value = 0
        parsedPosts.value = []
        selectedAccounts.value = []
        scheduledPosts.value = []
        config.value = {
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            postsPerDay: 1,
            defaultTime: '09:00'
        }
    }

    return {
        currentStep,
        parsedPosts,
        config,
        selectedAccounts,
        scheduledPosts,
        isScheduling,
        generateSchedule,
        schedulePosts,
        reset
    }
}
