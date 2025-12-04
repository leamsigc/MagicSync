<!--  Translation file -->
<i18n src="../posts.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Premium multi-platform social media composer with AI integration,
 * master content + platform overrides, real-time validation, and glassmorphism UI
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 */
import { usePlatformConfiguration, type SocialMediaPlatformConfigurations } from '../composables/usePlatformConfiguration';
import type { PostCreateBase, Asset, PostWithAllData } from '#layers/BaseDB/db/schema';
import { useAI } from '../composables/useAI';
import { useValidation } from '../composables/useValidation';
import dayjs from 'dayjs';
import { CalendarDate } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import PhonePreview from './PhonePreview.vue';
import PostPlatformSelector from './editor/PostPlatformSelector.vue';
import PostContextSwitcher from './editor/PostContextSwitcher.vue';
import PostContentEditor from './editor/PostContentEditor.vue';
import PostAIAssistant from './editor/PostAIAssistant.vue';
import PostThreadEditor from './editor/PostThreadEditor.vue';

interface TargetPlatform {
  accountId: string;
  platformType: keyof SocialMediaPlatformConfigurations;
}

interface PlatformOverride {
  content?: string;
  comments?: string[];
}

interface PostForm extends Omit<PostCreateBase, 'targetPlatforms' | 'mediaAssets'> {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  targetPlatforms: TargetPlatform[];
  comment: string[];
  mediaAssets: string[];
  tags?: string[];
  categories?: string[];
  privacySetting?: 'public' | 'private' | 'unlisted';
  isShort?: boolean;
  isStory?: boolean;
  hasSound?: boolean;
}

const props = defineProps<{
  initialPost?: PostWithAllData;
}>();

const emit = defineEmits(['save', 'update', 'close']);

const { t } = useI18n();
const toast = useToast();
const { getAllSocialMediaAccounts, pagesList } = useSocialMediaManager();
const { platformConfigurations } = usePlatformConfiguration();
const { smartSplit, rewriteContent, fixGrammar, generateHashtags, isLoading: aiLoading } = useAI();
const { validatePlatform } = useValidation();

// Master Content State
const masterContent = ref('');
const masterComments = ref<string[]>([]);
const masterMedia = ref<Asset[]>([]);

// Platform Overrides State
const platformOverrides = ref<Record<string, PlatformOverride>>({});

// Active Context (which tab is selected)
const activeContext = ref<'master' | string>('master');

// Post Form
const postForm = ref<PostForm>({
  content: '',
  businessId: '',
  scheduledAt: new Date(),
  mediaAssets: [],
  targetPlatforms: [],
  status: 'pending',
  comment: []
});

// Scheduling
const now = new Date();
const selectedDate = shallowRef(
  new CalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  )
);

// Computed Properties
const activeBusinessId = computed(() => postForm.value.businessId || '');

const availablePlatforms = computed(() => {
  if (!pagesList.value) return [];
  return pagesList.value.map((page: any) => ({
    type: page.platform as keyof SocialMediaPlatformConfigurations,
    name: page.name,
    icon: getPlatformIcon(page.platform),
    id: page.id
  }));
});

const selectedPlatformTypes = computed(() => {
  return postForm.value.targetPlatforms;
});

const contextTabs = computed(() => {
  const tabs = [
    { label: 'Master', value: 'master', icon: 'lucide:globe' }
  ];

  postForm.value.targetPlatforms.forEach(platform => {
    tabs.push({
      label: platform.platformType.charAt(0).toUpperCase() + platform.platformType.slice(1),
      value: platform.platformType,
      icon: getPlatformIcon(platform.platformType)
    });
  });

  return tabs;
});

const currentContent = computed({
  get: () => {
    if (activeContext.value === 'master') return masterContent.value;
    return platformOverrides.value[activeContext.value]?.content ?? masterContent.value;
  },
  set: (val: string) => {
    if (activeContext.value === 'master') {
      masterContent.value = val;
    } else {
      if (!platformOverrides.value[activeContext.value]) {
        platformOverrides.value[activeContext.value] = {};
      }
      platformOverrides.value[activeContext.value]!.content = val;
    }
  }
});

const currentComments = computed({
  get: () => {
    if (activeContext.value === 'master') return masterComments.value;
    return platformOverrides.value[activeContext.value]?.comments ?? masterComments.value;
  },
  set: (val: string[]) => {
    if (activeContext.value === 'master') {
      masterComments.value = val;
    } else {
      if (!platformOverrides.value[activeContext.value]) {
        platformOverrides.value[activeContext.value] = {};
      }
      platformOverrides.value[activeContext.value]!.comments = val;
    }
  }
});

const activeContextLabel = computed(() => {
  return contextTabs.value.find(t => t.value === activeContext.value)?.label || 'Unknown';
});

const validationStatus = computed(() => {
  const status: Record<string, { isValid: boolean; message?: string }> = {};

  postForm.value.targetPlatforms.forEach(platform => {
    const contentToValidate = platformOverrides.value[platform.platformType]?.content ?? masterContent.value;
    const commentsToValidate = platformOverrides.value[platform.platformType]?.comments ?? masterComments.value;

    // Use the new validation composable
    const result = validatePlatform(
      platform.platformType,
      contentToValidate,
      masterMedia.value,
      commentsToValidate
    );

    status[platform.platformType] = {
      isValid: result.status === 'valid',
      message: result.messages[0]
    };
  });

  return status;
});

const currentPlatformConfig = computed(() => {
  if (activeContext.value === 'master') {
    // Return a default config or the most restrictive one?
    // For now, let's return a generic default
    return platformConfigurations['default'];
  }
  return platformConfigurations[activeContext.value as keyof SocialMediaPlatformConfigurations] || platformConfigurations['default'];
});

// Methods
const getPlatformIcon = (provider: string) => {

  switch (provider) {
    case 'facebook': return 'lucide:facebook';
    case 'instagram': return 'lucide:instagram';
    case 'twitter': return 'lucide:twitter';
    case 'linkedin': return 'lucide:linkedin';
    case 'tiktok': return 'lucide:music-2';
    case 'threads': return 'logos:threads';
    case 'bluesky': return 'logos:bluesky';
    case 'google': return 'lucide:google';
    case 'email-password': return 'lucide:mail';
    case 'youtube': return 'lucide:youtube';
    case 'pinterest': return 'lucide:pinterest';
    case 'mastodon': return 'lucide:mastodon';
    default: return 'lucide:share-2';
  }
};

const togglePlatform = (platform: Platform) => {
  const index = postForm.value.targetPlatforms.findIndex(p => p.platformType === platform.type);
  if (index === -1) {
    postForm.value.targetPlatforms.push({
      accountId: platform.id,
      platformType: platform.type
    });
  } else {
    postForm.value.targetPlatforms.splice(index, 1);
    // Also remove override if exists
    if (platformOverrides.value[platform.type]) {
      delete platformOverrides.value[platform.type];
    }
    // If active context was this platform, switch to master
    if (activeContext.value === platform.type) {
      activeContext.value = 'master';
    }
  }
};

const revertToMaster = () => {
  if (activeContext.value !== 'master') {
    delete platformOverrides.value[activeContext.value];
    // Force reactivity update if needed, but Vue should handle it
  }
};

const handleAIAction = async (action: string) => {
  if (!currentContent.value) return;

  try {
    let result;
    switch (action) {
      case 'rewrite-professional':
        result = await rewriteContent(currentContent.value, 'professional');
        if (result) currentContent.value = result;
        break;
      case 'rewrite-fun':
        result = await rewriteContent(currentContent.value, 'fun');
        if (result) currentContent.value = result;
        break;
      case 'rewrite-concise':
        result = await rewriteContent(currentContent.value, 'concise');
        if (result) currentContent.value = result;
        break;
      case 'fix-grammar':
        result = await fixGrammar(currentContent.value);
        if (result) currentContent.value = result;
        break;
      case 'generate-hashtags':
        const hashtags = await generateHashtags(currentContent.value);
        if (hashtags) currentContent.value += `\n\n${hashtags.join(' ')}`;
        break;
      case 'smart-split':
        const thread = await smartSplit(currentContent.value, selectedPlatformTypes.value);
        if (thread && thread.length > 0) {
          currentContent.value = thread[0];
          currentComments.value = thread.slice(1);
        }
        break;
    }
  } catch (error) {
    toast.add({
      title: 'AI Error',
      description: 'Failed to process AI request',
      color: 'red'
    });
  }
};

const addComment = (comment: string) => {
  currentComments.value = [...currentComments.value, comment];
};

const removeComment = (index: number) => {
  const newComments = [...currentComments.value];
  newComments.splice(index, 1);
  currentComments.value = newComments;
};

const handleSavePost = async () => {
  // Basic validation
  if (!masterContent.value && masterMedia.value.length === 0) {
    toast.add({ title: 'Error', description: 'Post content cannot be empty', color: 'red' });
    return;
  }

  if (postForm.value.targetPlatforms.length === 0) {
    toast.add({ title: 'Error', description: 'Select at least one platform', color: 'red' });
    return;
  }

  // Construct final post object
  const finalPost: PostForm = {
    ...postForm.value,
    content: masterContent.value,
    comment: masterComments.value,
    mediaAssets: masterMedia.value.map(m => m.id),
    status: 'pending' // Ensure status is set
  };

  // TODO: Handle platform overrides in the save logic (backend support needed)
  // For now we just emit the master content and basic structure

  emit('save', finalPost);
};

const ResetToBase = () => {
  masterContent.value = '';
  masterComments.value = [];
  masterMedia.value = [];
  platformOverrides.value = {};
  activeContext.value = 'master';
  postForm.value = {
    content: '',
    businessId: '',
    scheduledAt: new Date(),
    mediaAssets: [],
    targetPlatforms: [],
    status: 'pending',
    comment: []
  };
};

defineExpose({
  ResetToBase
});

// Lifecycle
onMounted(async () => {
  await getAllSocialMediaAccounts();
  if (props.initialPost) {
    // Populate form if editing
    masterContent.value = props.initialPost.content || '';
    // ... other fields
  }
});
const platform = computed(() => {
  return (activeContext.value === 'master' ? (selectedPlatformTypes.value[0] || 'default') : activeContext.value) as keyof SocialMediaPlatformConfigurations | 'default'
})
</script>

<template>
  <div class="flex  max-w-[1400px] overflow-hidden  rounded-2xl shadow-2xl ">

    <!-- LEFT COLUMN: Editor -->
    <div class="flex-1 flex flex-col min-w-0  ">
      <!-- Header -->
      <div class="px-6 py-4   flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold">{{ t('create_post.title') }}</h2>
          <p class="text-sm text-muted">{{ t('create_post.description') }}</p>
        </div>
        <div class="flex items-center gap-3">
          <UButton color="gray" variant="ghost" @click="$emit('close')">{{ t('buttons.cancel') }}</UButton>
          <UButton color="indigo" @click="handleSavePost">{{ t('buttons.schedule_post') }}</UButton>
        </div>
      </div>

      <!-- Scrollable Content Area -->
      <div class="flex-1 overflow-y-auto custom-scrollbar">
        <div class="p-6 space-y-6">

          <!-- Platform Selector -->
          <div>
            <label class="text-xs font-semibold  uppercase tracking-wider mb-3 block">
              {{ t('create_post.destinations') }}</label>
            <PostPlatformSelector :platforms="availablePlatforms" :selected-platforms="selectedPlatformTypes"
              :validation-status="validationStatus" @toggle="togglePlatform" />
          </div>

          <!-- Context Switcher -->
          <div class="flex items-center justify-between">
            <PostContextSwitcher v-model="activeContext" :tabs="contextTabs" />

            <button v-if="activeContext !== 'master'" @click="revertToMaster"
              class="text-xs  hover:text-red-400 flex items-center gap-1 transition-colors">
              <Icon name="lucide:rotate-ccw" class="w-3 h-3" />
              {{ t('create_post.revert_to_master') }}
            </button>
          </div>

          <!-- Main Editor Card -->
          <div
            class="bg-zinc-900/30 border  rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <div v-if="activeContext !== 'master'" class=" px-4 py-2  border-primary/20 flex items-center gap-2">
              <Icon name="lucide:info" class="w-4 h-4 text-indigo-400" />
              <span class="text-xs text-indigo-300"
                v-html="t('create_post.editing_platform_only', { platform: `<strong>${activeContextLabel}</strong>` })"></span>
            </div>

            <PostContentEditor v-model="currentContent" :character-count="currentContent.length"
              :max-characters="currentPlatformConfig.maxPostLength"
              :placeholder="`Drafting for ${activeContextLabel}...`">
              <template #ai-tools>
                <PostAIAssistant :loading="aiLoading" @action="handleAIAction" />
              </template>
            </PostContentEditor>
          </div>

          <!-- Thread / Comments -->
          <PostThreadEditor :comments="currentComments" @add-comment="addComment" @remove-comment="removeComment" />

        </div>
      </div>
    </div>

    <!-- RIGHT COLUMN: Preview -->
    <div class="w-[420px]  flex flex-col border-l ">
      <div class="px-6 py-4  ">
        <h3 class="text-xs font-semibold  uppercase tracking-wider">{{ t('create_post.live_preview') }}</h3>
      </div>

      <div class="flex-1 overflow-y-auto p-6 flex items-center justify-center ">
        <PhonePreview :platform="platform" :content="currentContent" :comments="currentComments" :media="masterMedia" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
</style>
