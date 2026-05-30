<script lang="ts" setup>
import { useGMBManager } from './composables/useGMBManager'

const route = useRoute()
const router = useRouter()
const businessId = route.params.id as string
const { t } = useI18n()
const toast = useToast()

const {
  locations, isLoading, error,
  getLocations, getReviewStats, syncGMB
} = useGMBManager()

const reviewStats = ref<any>(null)
const showCreatePost = ref(false)
const selectedLocationId = ref<string | null>(null)

const postForm = ref({
  summary: '',
  topicType: 'STANDARD' as 'STANDARD' | 'EVENT' | 'OFFER',
  eventTitle: '',
  eventStartDate: '',
  eventEndDate: '',
  callToActionType: '' as string,
  callToActionUrl: '',
  offerCouponCode: '',
  offerRedeemUrl: '',
  offerTerms: '',
})

onMounted(async () => {
  try {
    await Promise.all([
      getLocations(businessId),
      getReviewStats(businessId).then(r => { if (r?.success) reviewStats.value = r.data }),
    ])
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message || 'Failed to load GMB data', color: 'error' })
  }
})

const handleSync = async () => {
  try {
    const result = await syncGMB(businessId)
    if (result.success) {
      toast.add({ title: 'Synced', description: 'GMB profiles synced successfully', color: 'success' })
      await getLocations(businessId)
    }
  } catch (e: any) {
    toast.add({ title: 'Sync Failed', description: e.message, color: 'error' })
  }
}

const handleCreatePost = async () => {
  if (!selectedLocationId.value) {
    toast.add({ title: 'Error', description: 'Select a location first', color: 'warning' })
    return
  }
  try {
    const postData: any = {
      topicType: postForm.value.topicType,
      summary: postForm.value.summary,
    }
    if (postForm.value.topicType === 'EVENT') {
      postData.event = {
        title: postForm.value.eventTitle,
        schedule: {
          startDate: { year: parseInt(postForm.value.eventStartDate.split('-')[0]), month: parseInt(postForm.value.eventStartDate.split('-')[1]), day: parseInt(postForm.value.eventStartDate.split('-')[2]) },
          endDate: postForm.value.eventEndDate ? { year: parseInt(postForm.value.eventEndDate.split('-')[0]), month: parseInt(postForm.value.eventEndDate.split('-')[1]), day: parseInt(postForm.value.eventEndDate.split('-')[2]) } : undefined,
        }
      }
    }
    if (postForm.value.topicType === 'OFFER') {
      postData.offer = {
        couponCode: postForm.value.offerCouponCode,
        redeemOnlineUrl: postForm.value.offerRedeemUrl,
        termsConditions: postForm.value.offerTerms,
      }
    }
    if (postForm.value.callToActionType) {
      postData.callToAction = {
        actionType: postForm.value.callToActionType,
        url: postForm.value.callToActionUrl || undefined,
      }
    }
    const result: any = await $fetch('/api/v1/gmb/posts', {
      method: 'POST',
      body: { businessId, locationName: selectedLocationId.value, postData }
    })
    if (result.success) {
      toast.add({ title: 'Posted', description: 'GMB post created successfully', color: 'success' })
      showCreatePost.value = false
      postForm.value = { summary: '', topicType: 'STANDARD', eventTitle: '', eventStartDate: '', eventEndDate: '', callToActionType: '', callToActionUrl: '', offerCouponCode: '', offerRedeemUrl: '', offerTerms: '' }
    }
  } catch (e: any) {
    toast.add({ title: 'Post Failed', description: e.message, color: 'error' })
  }
}

useHead({
  title: 'Google Business Profile Management',
})
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Google Business Profile</h1>
        <p class="text-gray-500">Manage your Google My Business locations, reviews, and posts</p>
      </div>
      <div class="flex gap-2">
        <UButton color="primary" variant="outline" @click="handleSync" :loading="isLoading">
          Sync from Google
        </UButton>
        <UButton color="primary" @click="showCreatePost = !showCreatePost">
          {{ showCreatePost ? 'Cancel' : 'New Post' }}
        </UButton>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
      {{ error }}
    </div>

    <div v-if="reviewStats" class="grid grid-cols-4 gap-4">
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold">{{ reviewStats.totalReviews }}</div>
          <div class="text-sm text-gray-500">Total Reviews</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold">{{ reviewStats.averageRating }}</div>
          <div class="text-sm text-gray-500">Average Rating</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold">{{ reviewStats.responseRate }}%</div>
          <div class="text-sm text-gray-500">Response Rate</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold">{{ reviewStats.shareRate }}%</div>
          <div class="text-sm text-gray-500">Share Rate</div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="loc in locations" :key="loc.id" :ui="{ body: { padding: 'p-0' } }">
        <div class="p-4">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-lg">{{ loc.name }}</h3>
              <p v-if="loc.location" class="text-sm text-gray-500">{{ loc.location }}</p>
            </div>
            <div v-if="loc.picture" class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img :src="loc.picture" :alt="loc.name" class="w-full h-full object-cover" />
            </div>
          </div>
          <div v-if="loc.category || loc.phone" class="mt-2 space-y-1 text-sm text-gray-600">
            <p v-if="loc.category">Category: {{ loc.category }}</p>
            <p v-if="loc.phone">{{ loc.phone }}</p>
          </div>
          <div class="mt-4 flex gap-2">
            <UButton size="xs" color="primary" variant="solid" @click="router.push(`/app/business/${businessId}/gmb/reviews?location=${loc.id}`)">
              Reviews
            </UButton>
            <UButton size="xs" color="secondary" variant="outline" @click="router.push(`/app/business/${businessId}/gmb/analytics?location=${loc.id}`)">
              Analytics
            </UButton>
          </div>
        </div>
      </UCard>
      <UCard v-if="!locations.length && !isLoading">
        <div class="p-8 text-center text-gray-500">
          No locations found. Connect your Google Business account and click "Sync from Google".
        </div>
      </UCard>
    </div>

    <UModal v-model="showCreatePost">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Create GMB Post</h3>
        </template>
        <div class="space-y-4">
          <UFormGroup label="Location">
            <USelect v-model="selectedLocationId" :options="locations.map(l => ({ label: l.name, value: l.id }))" />
          </UFormGroup>
          <UFormGroup label="Post Type">
            <USelect v-model="postForm.topicType" :options="[
              { label: 'Standard', value: 'STANDARD' },
              { label: 'Event', value: 'EVENT' },
              { label: 'Offer', value: 'OFFER' },
            ]" />
          </UFormGroup>
          <UFormGroup label="Content">
            <UTextarea v-model="postForm.summary" rows="4" maxlength="1500" />
          </UFormGroup>
          <UFormGroup v-if="postForm.topicType === 'EVENT'" label="Event Title">
            <UInput v-model="postForm.eventTitle" />
          </UFormGroup>
          <UFormGroup v-if="postForm.topicType === 'EVENT'" label="Start Date">
            <UInput v-model="postForm.eventStartDate" type="date" />
          </UFormGroup>
          <UFormGroup v-if="postForm.topicType === 'EVENT'" label="End Date">
            <UInput v-model="postForm.eventEndDate" type="date" />
          </UFormGroup>
          <UFormGroup v-if="postForm.topicType === 'OFFER'" label="Coupon Code">
            <UInput v-model="postForm.offerCouponCode" />
          </UFormGroup>
          <UFormGroup v-if="postForm.topicType === 'OFFER'" label="Redeem URL">
            <UInput v-model="postForm.offerRedeemUrl" type="url" />
          </UFormGroup>
          <UFormGroup v-if="postForm.topicType === 'OFFER'" label="Terms & Conditions">
            <UTextarea v-model="postForm.offerTerms" rows="3" />
          </UFormGroup>
          <UFormGroup label="Call to Action">
            <USelect v-model="postForm.callToActionType" :options="[
              { label: 'None', value: '' },
              { label: 'Book', value: 'BOOK' },
              { label: 'Order', value: 'ORDER' },
              { label: 'Shop', value: 'SHOP' },
              { label: 'Learn More', value: 'LEARN_MORE' },
              { label: 'Sign Up', value: 'SIGN_UP' },
              { label: 'Call', value: 'CALL' },
            ]" />
          </UFormGroup>
          <UFormGroup v-if="postForm.callToActionType && postForm.callToActionType !== 'CALL'" label="CTA URL">
            <UInput v-model="postForm.callToActionUrl" type="url" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" @click="showCreatePost = false">Cancel</UButton>
            <UButton color="primary" @click="handleCreatePost" :loading="isLoading">Publish</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
