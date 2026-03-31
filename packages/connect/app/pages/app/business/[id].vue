<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const businessId = String(route.params.id || '');

const business = ref(null as any);
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref('overview');

const posts = ref<any[]>([]);
const assets = ref<any[]>([]);
const connections = ref<any[]>([]);
const reviews = ref<any[]>([]);

// Modal states
const modals = ref({
  blogPost: false,
  seoAudit: false,
  growPlan: false,
  geoAudit: false,
  engagement: false
});

const blogPostData = ref({
  title: '',
  content: '',
  topic: '',
  keyword: '',
  format: 'markdown' as 'text' | 'markdown' | 'html',
  loading: false,
  error: null as string | null
});

const seoAuditData = ref({
  loading: false,
  results: null as any,
  error: null as string | null
});

const growPlanData = ref({
  loading: false,
  plan: null as any,
  error: null as string | null
});

const geoAuditData = ref({
  keyword: '',
  loading: false,
  results: null as any,
  error: null as string | null
});

const engagementData = ref({
  selectedSocial: '',
  keyword: '',
  loading: false,
  results: null as any,
  error: null as string | null
});

async function loadBusiness() {
  loading.value = true;
  try {
    const resp = await $fetch<any>(`/api/v1/business/${businessId}`);
    if (!resp) {
      error.value = 'Business not found';
      return;
    }
    business.value = resp;
  } catch (err) {
    error.value = String(err);
  } finally {
    loading.value = false;
  }
}

async function loadRelated() {
  if (!businessId) return;
  try {
    const [c, p, a, r] = await Promise.all([
      $fetch(`/api/v1/social-accounts?businessId=${businessId}`).catch(() => []),
      $fetch(`/api/v1/posts?businessId=${businessId}`).catch(() => ({ data: [] })).then((v: any) => v.data || []),
      $fetch(`/api/v1/assets?businessId=${businessId}`).catch(() => []),
      $fetch(`/api/v1/reviews?businessId=${businessId}`).catch(() => ({ data: [] })).then((v: any) => v.data || [])
    ]);
    connections.value = c || [];
    posts.value = p || [];
    assets.value = a || [];
    reviews.value = r || [];
  } catch (err) {
    console.error('Error loading related resources', err);
  }
}

async function generateBlogPost() {
  if (!blogPostData.value.topic && !blogPostData.value.keyword) {
    blogPostData.value.error = 'Please provide a topic or keyword';
    return;
  }
  blogPostData.value.loading = true;
  blogPostData.value.error = null;
  try {
    const res = await $fetch('/api/v1/ai/business/generate-blog', {
      method: 'POST',
      body: {
        businessId,
        topic: blogPostData.value.topic,
        keyword: blogPostData.value.keyword,
        businessDetails: business.value
      }
    });
    blogPostData.value.content = res.content;
    blogPostData.value.title = res.title;
  } catch (err: any) {
    blogPostData.value.error = err.data?.message || 'Failed to generate blog post';
  } finally {
    blogPostData.value.loading = false;
  }
}

function copyBlogContent() {
  const text = blogPostData.value.format === 'text'
    ? blogPostData.value.content
    : blogPostData.value.format === 'markdown'
    ? blogPostData.value.content
    : `<article>${blogPostData.value.content}</article>`;
  navigator.clipboard.writeText(text);
}

function saveBlogPost() {
  router.push(`/app/content/new?title=${encodeURIComponent(blogPostData.value.title)}&content=${encodeURIComponent(blogPostData.value.content)}&fromBusiness=${businessId}`);
}

async function runSeoAudit() {
  seoAuditData.value.loading = true;
  seoAuditData.value.error = null;
  try {
    const res = await $fetch(`/api/v1/ai/business/seo-audit/${businessId}`);
    seoAuditData.value.results = res;
  } catch (err: any) {
    seoAuditData.value.error = err.data?.message || 'Failed to run SEO audit';
  } finally {
    seoAuditData.value.loading = false;
  }
}

async function generateGrowPlan() {
  growPlanData.value.loading = true;
  growPlanData.value.error = null;
  try {
    const res = await $fetch(`/api/v1/ai/business/grow-plan/${businessId}`, {
      method: 'POST',
      body: { connections: connections.value, posts: posts.value }
    });
    growPlanData.value.plan = res;
  } catch (err: any) {
    growPlanData.value.error = err.data?.message || 'Failed to generate grow plan';
  } finally {
    growPlanData.value.loading = false;
  }
}

async function runGeoAudit() {
  if (!geoAuditData.value.keyword) {
    geoAuditData.value.error = 'Please provide a keyword';
    return;
  }
  geoAuditData.value.loading = true;
  geoAuditData.value.error = null;
  try {
    const res = await $fetch(`/api/v1/ai/business/geo-audit/${businessId}`, {
      method: 'POST',
      body: { keyword: geoAuditData.value.keyword }
    });
    geoAuditData.value.results = res;
  } catch (err: any) {
    geoAuditData.value.error = err.data?.message || 'Failed to run GEO audit';
  } finally {
    geoAuditData.value.loading = false;
  }
}

async function searchEngagementTargets() {
  if (!engagementData.value.keyword || !engagementData.value.selectedSocial) {
    engagementData.value.error = 'Please select a platform and provide a keyword';
    return;
  }
  engagementData.value.loading = true;
  engagementData.value.error = null;
  try {
    const res = await $fetch(`/api/v1/ai/business/engagement-targets/${businessId}`, {
      method: 'POST',
      body: {
        platform: engagementData.value.selectedSocial,
        keyword: engagementData.value.keyword,
        businessDetails: business.value
      }
    });
    engagementData.value.results = res;
  } catch (err: any) {
    engagementData.value.error = err.data?.message || 'Failed to search engagement targets';
  } finally {
    engagementData.value.loading = false;
  }
}

function actionCreatePost() {
  router.push(`/app/posts/new?businessId=${businessId}`);
}

onMounted(async () => {
  await loadBusiness();
  await loadRelated();
});
</script>

<template>
  <div>
    <BasePageHeader :title="business?.name || 'Business'" :description="business?.description || ''" />
    <div class="p-4">
      <div class="grid grid-cols-3 gap-2 mb-6">
        <UButton color="primary" @click="modals.blogPost = true" :disabled="loading">📝 Create blog post</UButton>
        <UButton color="primary" @click="actionCreatePost" :disabled="loading">📱 Create social post</UButton>
        <UButton color="primary" @click="modals.seoAudit = true" :disabled="loading">🔍 SEO audit</UButton>
        <UButton color="primary" @click="modals.growPlan = true" :disabled="loading">📈 Grow plan</UButton>
        <UButton color="primary" @click="modals.geoAudit = true" :disabled="loading">🌍 GEO audit</UButton>
        <UButton color="primary" @click="modals.engagement = true" :disabled="loading">👥 Engagement targets</UButton>
      </div>

      <div>
        <div class="tabs mb-4">
          <button class="tab" :class="{ 'active': activeTab==='overview' }" @click="activeTab='overview'">Overview</button>
          <button class="tab" :class="{ 'active': activeTab==='connections' }" @click="activeTab='connections'">Connections ({{ connections.length }})</button>
          <button class="tab" :class="{ 'active': activeTab==='posts' }" @click="activeTab='posts'">Posts ({{ posts.length }})</button>
          <button class="tab" :class="{ 'active': activeTab==='assets' }" @click="activeTab='assets'">Assets ({{ assets.length }})</button>
          <button class="tab" :class="{ 'active': activeTab==='reviews' }" @click="activeTab='reviews'">Reviews ({{ reviews.length }})</button>
        </div>

        <div v-if="loading" class="p-4">Loading…</div>
        <div v-else-if="error" class="p-4 text-red-500">{{ error }}</div>

        <div v-else>
          <div v-if="activeTab === 'overview'" class="p-4 bg-white rounded shadow">
            <h3 class="text-lg font-semibold">Overview</h3>
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p><strong>Name:</strong> {{ business.name }}</p>
                <p><strong>Description:</strong> {{ business.description }}</p>
                <p><strong>Category:</strong> {{ business.category }}</p>
              </div>
              <div>
                <p><strong>Website:</strong> <a :href="business.website" target="_blank" class="text-blue-600">{{ business.website }}</a></p>
                <p><strong>Phone:</strong> {{ business.phone }}</p>
                <p><strong>Address:</strong> {{ business.address }}</p>
              </div>
            </div>

            <div v-if="business.entityDetail" class="mt-6 pt-6 border-t">
              <h4 class="text-md font-semibold mb-3">Entity Details</h4>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="(value, key) in business.entityDetail.details" :key="key"
                  class="p-3 border rounded text-left hover:bg-gray-50"
                  @click="activeTab = 'entity:' + key">
                  <strong class="block text-sm">{{ key }}</strong>
                  <div class="text-xs text-gray-600 truncate mt-1">
                    {{ typeof value === 'string' ? value : JSON.stringify(value).slice(0,60) }}
                  </div>
                </button>
              </div>
              <div v-if="activeTab.startsWith('entity:')" class="mt-4 p-3 border rounded bg-gray-50">
                <pre class="whitespace-pre-wrap text-sm">{{ JSON.stringify(business.entityDetail.details[activeTab.replace('entity:','')], null, 2) }}</pre>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'connections'" class="p-4 bg-white rounded shadow">
            <h3 class="text-lg font-semibold">Connections</h3>
            <div v-if="connections.length === 0" class="text-muted mt-2">No connections</div>
            <ul v-else>
              <li v-for="c in connections" :key="c.id" class="py-2 border-b">
                <strong>{{ c.platform || c.platformId }}</strong> — {{ c.accountName || c.name }}
              </li>
            </ul>
          </div>

          <div v-if="activeTab === 'posts'" class="p-4 bg-white rounded shadow">
            <h3 class="text-lg font-semibold">Posts</h3>
            <div v-if="posts.length === 0" class="text-muted mt-2">No posts</div>
            <ul v-else>
              <li v-for="p in posts" :key="p.id" class="py-2 border-b">{{ p.title || p.content?.slice(0,80) }}</li>
            </ul>
          </div>

          <div v-if="activeTab === 'assets'" class="p-4 bg-white rounded shadow">
            <h3 class="text-lg font-semibold">Assets</h3>
            <div v-if="assets.length === 0" class="text-muted mt-2">No assets</div>
            <ul v-else class="grid grid-cols-4 gap-2">
              <li v-for="a in assets" :key="a.id" class="p-2 border rounded">
                <img :src="a.url" alt="asset" class="w-full h-20 object-cover rounded" />
              </li>
            </ul>
          </div>

          <div v-if="activeTab === 'reviews'" class="p-4 bg-white rounded shadow">
            <h3 class="text-lg font-semibold">Reviews</h3>
            <div v-if="reviews.length === 0" class="text-muted mt-2">No reviews</div>
            <ul v-else>
              <li v-for="rev in reviews" :key="rev.id" class="py-2 border-b">
                <strong>{{ rev.author }}</strong> — {{ rev.content }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Blog Post Modal -->
    <UModal v-model="modals.blogPost" title="Create AI-Optimized Blog Post">
      <div class="space-y-4 p-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Topic</label>
          <input v-model="blogPostData.topic" placeholder="e.g., Digital Marketing Tips" class="w-full p-2 border rounded" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Target Keyword</label>
          <input v-model="blogPostData.keyword" placeholder="e.g., SEO optimization" class="w-full p-2 border rounded" />
        </div>
        <div v-if="blogPostData.content">
          <label class="block text-sm font-semibold mb-2">Format</label>
          <select v-model="blogPostData.format" class="w-full p-2 border rounded">
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </div>
        <div v-if="blogPostData.error" class="p-2 bg-red-100 text-red-700 rounded text-sm">{{ blogPostData.error }}</div>
        <div v-if="blogPostData.content" class="p-3 bg-gray-50 rounded max-h-64 overflow-y-auto">
          <h4 class="font-semibold mb-2">{{ blogPostData.title }}</h4>
          <p class="text-sm whitespace-pre-wrap">{{ blogPostData.content }}</p>
        </div>
        <div class="flex gap-2">
          <UButton @click="generateBlogPost" :disabled="blogPostData.loading || !blogPostData.topic">
            {{ blogPostData.loading ? 'Generating...' : 'Generate' }}
          </UButton>
          <UButton v-if="blogPostData.content" @click="copyBlogContent" color="neutral">Copy</UButton>
          <UButton v-if="blogPostData.content" @click="saveBlogPost" color="primary">Save to Editor</UButton>
        </div>
      </div>
    </UModal>

    <!-- SEO Audit Modal -->
    <UModal v-model="modals.seoAudit" title="SEO Audit Report">
      <div class="space-y-4 p-4">
        <div v-if="seoAuditData.loading" class="text-center py-4">Analyzing your site...</div>
        <div v-else-if="seoAuditData.error" class="p-3 bg-red-100 text-red-700 rounded text-sm">{{ seoAuditData.error }}</div>
        <div v-else-if="seoAuditData.results" class="space-y-3 max-h-96 overflow-y-auto">
          <div>
            <h4 class="font-semibold">Score: {{ seoAuditData.results.score }}/100</h4>
            <div class="w-full bg-gray-200 rounded h-2 mt-1">
              <div class="bg-green-500 h-2 rounded" :style="{ width: seoAuditData.results.score + '%' }"></div>
            </div>
          </div>
          <div>
            <h5 class="font-semibold text-sm">Issues Found</h5>
            <ul class="space-y-1 mt-2">
              <li v-for="(issue, i) in seoAuditData.results.issues" :key="i" class="text-sm flex items-start">
                <span class="mr-2">🔴</span>
                <span>{{ issue }}</span>
              </li>
            </ul>
          </div>
          <div>
            <h5 class="font-semibold text-sm">Recommendations</h5>
            <ul class="space-y-1 mt-2">
              <li v-for="(rec, i) in seoAuditData.results.recommendations" :key="i" class="text-sm flex items-start">
                <span class="mr-2">✅</span>
                <span>{{ rec }}</span>
              </li>
            </ul>
          </div>
        </div>
        <UButton v-if="!seoAuditData.results" @click="runSeoAudit" :disabled="seoAuditData.loading">Run Audit</UButton>
      </div>
    </UModal>

    <!-- Grow Plan Modal -->
    <UModal v-model="modals.growPlan" title="7-Day Growth Plan">
      <div class="space-y-4 p-4">
        <div v-if="growPlanData.loading" class="text-center py-4">Generating personalized growth plan...</div>
        <div v-else-if="growPlanData.error" class="p-3 bg-red-100 text-red-700 rounded text-sm">{{ growPlanData.error }}</div>
        <div v-else-if="growPlanData.plan" class="space-y-3 max-h-96 overflow-y-auto">
          <div v-for="day in growPlanData.plan.days" :key="day.day" class="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50 rounded">
            <h5 class="font-semibold text-sm">{{ day.day }}</h5>
            <p class="text-sm text-gray-700">{{ day.task }}</p>
          </div>
        </div>
        <UButton v-if="!growPlanData.plan" @click="generateGrowPlan" :disabled="growPlanData.loading">Generate Plan</UButton>
      </div>
    </UModal>

    <!-- GEO Audit Modal -->
    <UModal v-model="modals.geoAudit" title="GEO Audit & Local SEO">
      <div class="space-y-4 p-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Keyword</label>
          <input v-model="geoAuditData.keyword" placeholder="e.g., web design near me" class="w-full p-2 border rounded" />
        </div>
        <div v-if="geoAuditData.loading" class="text-center py-4">Analyzing local presence...</div>
        <div v-else-if="geoAuditData.error" class="p-3 bg-red-100 text-red-700 rounded text-sm">{{ geoAuditData.error }}</div>
        <div v-else-if="geoAuditData.results" class="space-y-2 max-h-64 overflow-y-auto">
          <div class="p-2 bg-yellow-50 rounded">
            <h5 class="font-semibold text-sm">Local Ranking: Position {{ geoAuditData.results.ranking }}</h5>
          </div>
          <div>
            <h5 class="font-semibold text-sm">Actions to Improve Ranking</h5>
            <ul class="mt-2 space-y-1">
              <li v-for="(action, i) in geoAuditData.results.actions" :key="i" class="text-sm flex items-start">
                <span class="mr-2">→</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>
        </div>
        <UButton @click="runGeoAudit" :disabled="geoAuditData.loading || !geoAuditData.keyword">Run GEO Audit</UButton>
      </div>
    </UModal>

    <!-- Engagement Targets Modal -->
    <UModal v-model="modals.engagement" title="Social Media Engagement Opportunities">
      <div class="space-y-4 p-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Platform</label>
          <select v-model="engagementData.selectedSocial" class="w-full p-2 border rounded">
            <option value="">Select platform</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">Twitter/X</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Target Keyword/Topic</label>
          <input v-model="engagementData.keyword" placeholder="e.g., digital marketing" class="w-full p-2 border rounded" />
        </div>
        <div v-if="engagementData.loading" class="text-center py-4">Finding engagement opportunities...</div>
        <div v-else-if="engagementData.error" class="p-3 bg-red-100 text-red-700 rounded text-sm">{{ engagementData.error }}</div>
        <div v-else-if="engagementData.results" class="space-y-2 max-h-96 overflow-y-auto">
          <div v-for="post in engagementData.results.opportunities" :key="post.id" class="border rounded p-2 hover:bg-gray-50">
            <p class="text-sm font-semibold">{{ post.title }}</p>
            <p class="text-xs text-gray-600">Engagement: {{ post.engagement }}</p>
            <button @click="router.push(`/app/posts/new?engagementId=${post.id}`)"
              class="text-xs text-blue-600 hover:underline mt-1">Create Similar Post</button>
          </div>
        </div>
        <UButton @click="searchEngagementTargets" :disabled="engagementData.loading || !engagementData.selectedSocial">Search Opportunities</UButton>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
.tabs { display:flex; gap:8px }
.tab { padding:8px 12px; border-radius:6px; background:#f3f4f6; cursor:pointer }
.tab.active { background:#1f2937; color:white }
</style>
