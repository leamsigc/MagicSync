<script lang="ts" setup>
import { useGMBManager } from './composables/useGMBManager'

const route = useRoute()
const businessId = route.params.id as string
const { t } = useI18n()
const toast = useToast()

const {
  isLoading, error,
  getReviews, getReviewStats, syncReviews,
  replyToReview, generateAIResponse, getResponseTemplates,
  getReviewImageUrl
} = useGMBManager()

const reviews = ref<any[]>([])
const reviewStatsData = ref<any>(null)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
const filterRating = ref<number>(0)
const filterHasResponse = ref<string>('all')

const selectedReview = ref<any>(null)
const replyText = ref('')
const showReplyModal = ref(false)
const showImagePreview = ref(false)
const imagePreviewHtml = ref('')
const aiResponseLoading = ref(false)
const templates = ref<string[]>([])

const loadReviews = async () => {
  try {
    const params: any = { page: pagination.value.page, limit: pagination.value.limit }
    if (filterRating.value > 0) {
      params.minRating = filterRating.value
      params.maxRating = filterRating.value
    }
    if (filterHasResponse.value === 'yes') params.hasResponse = true
    if (filterHasResponse.value === 'no') params.hasResponse = false

    const result = await getReviews(businessId, params)
    if (result?.data) {
      reviews.value = result.data
      pagination.value = result.pagination || pagination.value
    }
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      loadReviews(),
      getReviewStats(businessId).then(r => { if (r?.success) reviewStatsData.value = r.data }),
    ])
  } catch (e: any) {
    // silent
  }
})

const handleSyncReviews = async () => {
  try {
    const result = await syncReviews(businessId)
    if (result.success) {
      toast.add({ title: 'Synced', description: `${result.data?.length || 0} reviews synced`, color: 'success' })
      await loadReviews()
    }
  } catch (e: any) {
    toast.add({ title: 'Sync Failed', description: e.message, color: 'error' })
  }
}

const openReplyModal = async (review: any) => {
  selectedReview.value = review
  replyText.value = review.responseContent || ''
  try {
    const result = await getResponseTemplates(review.rating)
    if (result?.success) templates.value = result.data || []
  } catch {
    templates.value = []
  }
  showReplyModal.value = true
}

const handleSendReply = async () => {
  if (!selectedReview.value || !replyText.value.trim()) return
  try {
    const result = await replyToReview(businessId, selectedReview.value.id, replyText.value)
    if (result?.success) {
      toast.add({ title: 'Replied', description: 'Response sent to Google', color: 'success' })
      showReplyModal.value = false
      await loadReviews()
    }
  } catch (e: any) {
    toast.add({ title: 'Reply Failed', description: e.message, color: 'error' })
  }
}

const handleGenerateAI = async () => {
  if (!selectedReview.value) return
  aiResponseLoading.value = true
  try {
    const result = await generateAIResponse(selectedReview.value.id)
    if (result?.success) {
      replyText.value = result.data || ''
    }
  } catch (e: any) {
    toast.add({ title: 'AI Error', description: e.message, color: 'error' })
  } finally {
    aiResponseLoading.value = false
  }
}

const handlePreviewImage = async (review: any) => {
  selectedReview.value = review
  const url = getReviewImageUrl(businessId, review.id)
  try {
    const html = await $fetch<string>(url)
    imagePreviewHtml.value = html
    showImagePreview.value = true
  } catch (e: any) {
    toast.add({ title: 'Error', description: 'Failed to generate image preview', color: 'error' })
  }
}

const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

const formatDate = (date: Date | string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

watch(filterRating, () => { pagination.value.page = 1; loadReviews() })
watch(filterHasResponse, () => { pagination.value.page = 1; loadReviews() })

useHead({
  title: 'Google Reviews Management',
})
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Review Management</h1>
        <p class="text-gray-500">View, respond, and manage your Google Business reviews</p>
      </div>
      <UButton color="primary" variant="outline" @click="handleSyncReviews" :loading="isLoading">
        Sync Reviews
      </UButton>
    </div>

    <div v-if="reviewStatsData" class="grid grid-cols-5 gap-4">
      <UCard>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ reviewStatsData.totalReviews }}</div>
          <div class="text-xs text-gray-500">Total</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ reviewStatsData.averageRating }}</div>
          <div class="text-xs text-gray-500">Avg Rating</div>
        </div>
      </UCard>
      <UCard v-for="(count, rating) in reviewStatsData.ratingDistribution" :key="rating">
        <div class="text-center">
          <div class="text-2xl font-bold">{{ count }}</div>
          <div class="text-xs text-gray-500">{{ rating }} ★</div>
        </div>
      </UCard>
    </div>

    <div class="flex gap-4 items-center">
      <USelect v-model="filterRating" :options="[
        { label: 'All Ratings', value: 0 },
        { label: '5 ★', value: 5 },
        { label: '4 ★', value: 4 },
        { label: '3 ★', value: 3 },
        { label: '2 ★', value: 2 },
        { label: '1 ★', value: 1 },
      ]" class="w-40" />
      <USelect v-model="filterHasResponse" :options="[
        { label: 'All Reviews', value: 'all' },
        { label: 'Needs Response', value: 'no' },
        { label: 'Has Response', value: 'yes' },
      ]" class="w-44" />
    </div>

    <div class="space-y-3">
      <UCard v-for="review in reviews" :key="review.id">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3 flex-1">
            <UAvatar v-if="review.authorImage" :src="review.authorImage" :alt="review.authorName" size="md" />
            <UAvatar v-else :alt="review.authorName" size="md" />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-semibold">{{ review.authorName }}</span>
                <span class="text-yellow-500">{{ renderStars(review.rating) }}</span>
              </div>
              <p class="text-xs text-gray-500">{{ formatDate(review.reviewDate) }}</p>
              <p class="mt-2 text-gray-700">{{ review.content }}</p>
              <div v-if="review.responseContent" class="mt-3 pl-4 border-l-2 border-green-300 bg-green-50 rounded p-3">
                <p class="text-xs font-semibold text-green-700">Your Response:</p>
                <p class="text-sm text-green-800">{{ review.responseContent }}</p>
                <p v-if="review.responseDate" class="text-xs text-green-600 mt-1">{{ formatDate(review.responseDate) }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton v-if="!review.responseContent" size="xs" color="primary" @click="openReplyModal(review)">
            Reply
          </UButton>
          <UButton v-else size="xs" color="secondary" variant="outline" @click="openReplyModal(review)">
            Edit Reply
          </UButton>
          <UButton size="xs" color="white" variant="outline" @click="handlePreviewImage(review)">
            <template #leading>
              <UIcon name="i-heroicons-photo" />
            </template>
            Image
          </UButton>
        </div>
      </UCard>

      <div v-if="!reviews.length && !isLoading" class="text-center py-12 text-gray-500">
        No reviews found. Click "Sync Reviews" to fetch from Google.
      </div>
    </div>

    <div v-if="pagination.totalPages > 1" class="flex justify-center">
      <UPagination v-model="pagination.page" :page-count="pagination.limit" :total="pagination.total" @update:model-value="loadReviews" />
    </div>

    <UModal v-model="showReplyModal">
      <UCard>
        <template #header>
          <div>
            <h3 class="text-lg font-semibold">Reply to Review</h3>
            <p v-if="selectedReview" class="text-sm text-gray-500">
              {{ selectedReview.authorName }} - {{ renderStars(selectedReview.rating) }}
            </p>
          </div>
        </template>
        <div v-if="selectedReview" class="space-y-4">
          <div class="bg-gray-50 rounded p-3 text-sm">
            "{{ selectedReview.content }}"
          </div>
          <div v-if="templates.length" class="space-y-2">
            <p class="text-xs font-semibold text-gray-500">Response Templates:</p>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="(tmpl, i) in templates" :key="i" color="gray" variant="soft" class="cursor-pointer text-xs" @click="replyText = tmpl">
                {{ tmpl.substring(0, 60) }}...
              </UBadge>
            </div>
          </div>
          <UFormGroup label="Your Response">
            <UTextarea v-model="replyText" rows="4" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-between">
            <UButton color="secondary" variant="outline" @click="handleGenerateAI" :loading="aiResponseLoading">
              <template #leading>
                <UIcon name="i-heroicons-sparkles" />
              </template>
              Generate with AI
            </UButton>
            <div class="flex gap-2">
              <UButton color="gray" @click="showReplyModal = false">Cancel</UButton>
              <UButton color="primary" @click="handleSendReply" :loading="isLoading" :disabled="!replyText.trim()">
                Send Reply
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>

    <UModal v-model="showImagePreview" size="xl">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Review Image Preview</h3>
            <UButton color="primary" size="xs" variant="outline" @click="() => {
              const w = window.open('', '_blank')
              if (w) { w.document.write(imagePreviewHtml); w.document.close() }
            }">
              Open in Browser
            </UButton>
          </div>
        </template>
        <div v-if="imagePreviewHtml" class="flex justify-center bg-gray-100 rounded p-4">
          <div v-html="imagePreviewHtml"></div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
