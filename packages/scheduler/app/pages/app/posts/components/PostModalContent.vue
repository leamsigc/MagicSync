<!--  Translation file -->
<i18n src="../posts.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: This component encapsulates the main content and logic for creating or updating a social media post.
 * It handles post content, media assets, platform selection, previews, and validation.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { usePlatformConfiguration, type SocialMediaPlatformConfigurations, type PostFormat } from '../composables/usePlatformConfiguration';
import type { PostCreateBase, Asset, Post, PostWithAllData, SocialMediaComplete } from '#layers/BaseDB/db/schema';
import type { PlatformSettings } from '#layers/BaseScheduler/shared/platformSettings';
import dayjs from 'dayjs';
import PostPlatformSelector from './editor/PostPlatformSelector.vue';


import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import { useValidation } from '../composables/useValidation';
import PhonePreview from './PhonePreview.vue';
import PostContextSwitcher from './editor/PostContextSwitcher.vue';
import PostContentEditor from './editor/PostContentEditor.vue';
import PostFormatSelector from './PostFormatSelector.vue';
import { useAI } from '../composables/useAI';
import { usePlatformSettings } from '../composables/usePlatformSettings';
import EmojiPicker from '#layers/BaseScheduler/app/components/EmojiPicker.vue';
import { useBusinessManager } from '#layers/BaseConnect/app/pages/app/business/composables/useBusinessManager';
import PlatformSettingsPanel from '#layers/BaseScheduler/app/components/PlatformSettingsPanel.vue';

interface TargetPlatform {
  accountId: string;
  platformType: keyof SocialMediaPlatformConfigurations;
}

interface PlatformContentOverride {
  content: string;
  comments?: string[];
}

interface PostForm extends Omit<PostCreateBase, 'targetPlatforms' | 'mediaAssets' | 'platformContent' | 'platformSettings'> { // Removed 'comment', 'platformContent', 'platformSettings' from Omit to redefine
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  targetPlatforms: TargetPlatform[];
  comment: string[]; // PostCreateBase already defines this as string[]
  mediaAssets: string[];
  tags?: string[];
  categories?: string[];
  privacySetting?: 'public' | 'private' | 'unlisted';
  isShort?: boolean;
  isStory?: boolean;
  hasSound?: boolean;
  platformContent?: Record<string, PlatformContentOverride>; // NEW: Platform-specific content
  postFormat: PostFormat; // NEW: Selected post format
  platformSettings?: Record<string, PlatformSettings>;
}

const props = defineProps<{
  initialPost?: PostWithAllData;
}>();

const emit = defineEmits(['save', 'update', 'close']);

const { t } = useI18n();
const toast = useToast();
const { getAllSocialMediaAccounts, connectedSocialAccountsList } = useSocialMediaManager();
const { getAssetsByIds } = useAssetManager();
const { platformConfigurations, validatePostForPlatform } = usePlatformConfiguration();
const { businesses } = useBusinessManager();

const postForm = ref<PostForm>({
  content: '',
  businessId: '',
  scheduledAt: new Date(),
  mediaAssets: [],
  targetPlatforms: [],
  status: 'pending',
  comment: [],
  platformContent: {}, // NEW: Initialize platform content overrides
  postFormat: 'post', // NEW: Default format
  platformSettings: {},
});
const now = new Date();
const selectedDate = shallowRef(
  new CalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  )
)
const isDateUnavailable = (date: DateValue) => {
  return dayjs(date.toString()).isBefore(dayjs().add(-1, 'day'));
}
const selectedTime = ref(dayjs(postForm.value.scheduledAt).format('HH:mm'));

watch([selectedDate, selectedTime], () => {
  postForm.value.scheduledAt = dayjs(`${selectedDate.value}T${selectedTime.value}`).toDate();
});

const formattedScheduledAt = computed(() =>
  dayjs(postForm.value.scheduledAt).format('DD/MM/YYYY HH:mm')
);
const activeBusinessId = useState<string>('business:id');
const postMediaAssets = ref<Asset[]>([]);
const postHasError = ref(false);
const validationErrors = ref<{ platform: string; message: string }[]>([]);
const selectedPostFormat = ref<PostFormat>('post');

const explicitPreviewPlatform = ref<keyof typeof previewsMap | 'default'>('default');
const previewsMap = {
  facebook: '',
  instagram: '',
  twitter: '',
  google: '',
  'email-password': '',
  linkedin: '',
  tiktok: '',
  threads: '',
  youtube: '',
  pinterest: '',
  mastodon: '',
  bluesky: '',
  default: '',
};

onMounted(async () => {
  await getAllSocialMediaAccounts();
  if (props.initialPost) {
    console.log(props.initialPost);

    const platformPosts = props.initialPost.platformPosts;

    if (platformPosts && platformPosts.length > 0) {
      const firstPlatformPost = platformPosts[0];
      explicitPreviewPlatform.value = firstPlatformPost?.platformPostId as keyof typeof previewsMap || 'default';
    }

    const processedTargetPlatforms: TargetPlatform[] = platformPosts.map(p => ({
      accountId: p.socialAccountId,
      platformType: p.platformPostId as keyof SocialMediaPlatformConfigurations,
    }));
    const initialCommentsRaw = (props.initialPost as { comment?: string | string[] }).comment;
    const processedComments: string[] = Array.isArray(initialCommentsRaw)
      ? initialCommentsRaw
      : (initialCommentsRaw ? [initialCommentsRaw] : []);

    const initialMediaAssetsRaw = JSON.parse(props.initialPost.mediaAssets as string || "[]");
    const processedMediaAssetsIds: string[] = Array.isArray(initialMediaAssetsRaw)
      ? initialMediaAssetsRaw
      : (initialMediaAssetsRaw ? [initialMediaAssetsRaw] : []);

    postForm.value = {
      ...props.initialPost,
      targetPlatforms: processedTargetPlatforms,
      mediaAssets: processedMediaAssetsIds,
      comment: processedComments,
      platformContent: (props.initialPost as any).platformContent || {},
      platformSettings: (props.initialPost as any).platformSettings || {},
    } as PostForm;
    platformSettingsState.masterContent.value = postForm.value.content;
    platformSettingsState.masterComments.value = postForm.value.comment;
    platformSettingsState.platformContent.value = props.initialPost.platformContent as Record<string, PlatformContentOverride> || {};


    const scheduleAt = dayjs(postForm.value.scheduledAt).toDate();
    selectedTime.value = dayjs(postForm.value.scheduledAt).format('HH:mm');


    selectedDate.value = new CalendarDate(
      scheduleAt.getFullYear(),
      scheduleAt.getMonth() + 1,
      scheduleAt.getDate()
    );

    if (processedMediaAssetsIds.length > 0) {
      postMediaAssets.value = await getAssetsByIds(processedMediaAssetsIds);
    }
  }
});

const currentPreviewPlatform = computed(() => {
  if (explicitPreviewPlatform.value !== 'default') {
    return explicitPreviewPlatform.value;
  }
  return 'default';
});

const formatPostContent = (content: string, platformType: keyof typeof previewsMap | 'default'): string => {
  if (platformType === 'default') return content;
  const config = platformConfigurations[platformType];
  if (config && content.length > config.maxPostLength) {
    return content.substring(0, config.maxPostLength - 3) + '...';
  }
  return content;
};

const tabs = [{
  label: t('newPostModal.editorTab'),
  description: t('newPostModal.editorDescription'),
  icon: 'i-heroicons-pencil-square',
  slot: "editor" as const,
}, {
  label: t('newPostModal.mediaTab'),
  description: t('newPostModal.mediaDescription'),
  icon: 'i-heroicons-photo',
  slot: "media" as const
}];

const handleSavePost = async (status: 'pending' | 'published' | 'failed') => {
  validationErrors.value = [];
  postHasError.value = false;

  if (!postForm.value.content.trim() && postForm.value.mediaAssets.length === 0) {
    postHasError.value = true;
    toast.add({ title: t('validation.emptyPost'), icon: 'i-heroicons-exclamation-triangle', color: 'error' });
    return;
  }

  if (postForm.value.targetPlatforms.length === 0) {
    postHasError.value = true;
    toast.add({ title: t('validation.noPlatformSelected'), icon: 'i-heroicons-exclamation-triangle', color: 'error' });
    return;
  }

  let firstInvalidPlatform: TargetPlatform | null = null;

  for (const targetPlatform of postForm.value.targetPlatforms) {
    const { isValid, message } = validatePostForPlatform(postForm.value, postMediaAssets.value, targetPlatform.platformType);
    if (!isValid) {
      validationErrors.value.push({ platform: targetPlatform.platformType, message: message || t('validation.unknownError') });
      if (!firstInvalidPlatform) {
        firstInvalidPlatform = targetPlatform;
      }
    }
  }

  if (validationErrors.value.length > 0) {
    postHasError.value = true;
    if (firstInvalidPlatform) {
      explicitPreviewPlatform.value = firstInvalidPlatform.platformType as keyof typeof previewsMap;
      toast.add({
        title: t('validation.postInvalidForPlatform', { platform: firstInvalidPlatform.platformType }),
        description: validationErrors.value.map(e => e.message).join('\n'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error',
      });
    }
    return;
  }

  if (status === 'pending' && dayjs(postForm.value.scheduledAt).isBefore(dayjs())) {
    postHasError.value = true;
    toast.add({ title: t('validation.pastScheduledTime'), icon: 'i-heroicons-exclamation-triangle', color: 'error' });
    return;
  }

  const postData = {
    ...postForm.value,
    status: status,
    targetPlatforms: postForm.value.targetPlatforms.map(platform => platform.accountId),
    businessId: activeBusinessId.value,
    mediaAssets: postMediaAssets.value.map(asset => asset.id),
  };
  if (props.initialPost) {
    emit('update', postData);
  } else {
    emit('save', postData);
  }
}

const ResetToBase = () => {
  postForm.value = {
    content: '',
    businessId: '',
    scheduledAt: new Date(),
    mediaAssets: [],
    targetPlatforms: [],
    status: 'pending',
    comment: [],
    postFormat: 'post',
    platformSettings: {},
  }
  selectedDate.value = new CalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
  selectedTime.value = dayjs(postForm.value.scheduledAt).format('HH:mm');
  postMediaAssets.value = [];
  postHasError.value = false;
  validationErrors.value = [];
  explicitPreviewPlatform.value = 'default';
}

const HandleAssetsSelected = (assets: Asset[]) => {
  postMediaAssets.value = assets;
  postForm.value.mediaAssets = assets.map(asset => asset.id);
}

const haveAtLeastOneAccountSelected = computed(() => {
  return postForm.value.targetPlatforms.length === 0;
})
const setScheduleDateAt = (date: Date) => {

  postForm.value.scheduledAt = date;
  selectedDate.value = new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  selectedTime.value = dayjs(postForm.value.scheduledAt).format('HH:mm');
}

defineExpose({
  ResetToBase,
  setScheduleDateAt
});


/* Editor context */
interface PlatformOverride {
  content?: string;
  comments?: string[];
}

const { validatePlatform } = useValidation();
const masterMedia = ref<Asset[]>([]);

// Removed unused platformOverrides ref used incorrectly before


const platformSettingsState = usePlatformSettings();
const {
  currentContent,
  currentComments,
  addComment,
  removeComment,
  updateComment,
  hasPlatformOverride,
  getContentForPlatform,
  getCommentsForPlatform,
} = platformSettingsState;

watch(explicitPreviewPlatform, (val) => {
  platformSettingsState.selectedPlatform.value = val;
}, { immediate: true });

watch(() => postForm.value.content, (val) => {
  if (explicitPreviewPlatform.value === 'default') {
    platformSettingsState.masterContent.value = val;
  }
}, { immediate: true });

watch(platformSettingsState.masterContent, (val) => {
  if (explicitPreviewPlatform.value === 'default') {
    postForm.value.content = val;
  }
});

watch(() => postForm.value.comment, (val) => {
  if (explicitPreviewPlatform.value === 'default') {
    platformSettingsState.masterComments.value = val;
  }
}, { immediate: true });

watch(platformSettingsState.masterComments, (val) => {
  if (explicitPreviewPlatform.value === 'default') {
    postForm.value.comment = val;
  }
});

watch(platformSettingsState.platformContent, (val) => {
  postForm.value.platformContent = val;
}, { deep: true });

watch(platformSettingsState.platformSettings, (val) => {
  console.log("Platform settings changed");
  console.log(val);

  postForm.value.platformSettings = val;
}, { deep: true });

// Active Context (which tab is selected)

const contextTabs = computed(() => {
  // Define local interface for Tab compatible with PostContextSwitcher
  interface ContextTab {
    label: string;
    value: string;
    icon: string;
    hasOverride?: boolean;
    disabled?: boolean;
  }

  const tabs: ContextTab[] = [
    { label: 'Master', value: 'default', icon: 'lucide:globe' }
  ];

  postForm.value.targetPlatforms.forEach(platform => {
    // check if the platform type is already in the tabs
    const existingTab = tabs.find(tab => tab.value === platform.platformType);
    if (existingTab) {
      return;
    }

    // Check if this platform has an override
    // We check via the composable helper or directly from the form state if synced
    // The composable 'hasPlatformOverride' takes a platform *type* or *accountId*?
    // Looking at usePlatformSettings, it uses selectedPlatform which can be anything used as key map.
    // In TogglePlatform we seem to map by accountId? No, 'platformContent' usually keyed by platformName (like 'twitter', 'linkedin')
    // OR by accountId?
    // Let's check usePlatformSettings usage. It seems to use 'selectedPlatform.value' as the key.
    // In 'explicitPreviewPlatform' watcher, we set selectedPlatform.value = val. 'val' comes from 'explicitPreviewPlatform'.
    // 'explicitPreviewPlatform' is set to 'default' or 'platformType' (e.g. 'twitter').
    // So overrides are keyed by PLATFORM TYPE (e.g. 'twitter'), not accountId.

    const hasOverride = !!postForm.value.platformContent?.[platform.platformType]?.content;

    tabs.push({
      label: platform.platformType.charAt(0).toUpperCase() + platform.platformType.slice(1),
      value: platform.platformType,
      icon: `logos:${platform.platformType}`,
      hasOverride
    });
  });
  return tabs;
});
const activeContextLabel = computed(() => {
  return contextTabs.value.find(t => t.value === explicitPreviewPlatform.value)?.label || 'Unknown';
});

/* Account selections  */
const selectedSocialMediaAccounts = computed(() => {
  const connectedIds = postForm.value.targetPlatforms.map(platform => platform.accountId);
  return connectedSocialAccountsList.value.filter((account: { id: string; }) => connectedIds.includes(account.id));
})

const togglePlatform = (account: SocialMediaComplete) => {
  const connectedIds = postForm.value.targetPlatforms.map(platform => platform.accountId);

  if (connectedIds.includes(account.id)) {
    postForm.value.targetPlatforms = postForm.value.targetPlatforms.filter(platform => platform.accountId !== account.id);
  } else {
    postForm.value.targetPlatforms.push({ accountId: account.id, platformType: account.platform as keyof SocialMediaPlatformConfigurations });
  }
}
const validationStatus = computed(() => {
  const status: Record<string, { isValid: boolean; errors: string[]; warnings: string[]; }> = {};

  postForm.value.targetPlatforms.forEach(platform => {
    // Correctly accessing content:
    // If there is an override for this platform TYPE, use it. Otherwise use master content.
    // The PostForm stores overrides by platform TYPE (string key in Record).
    const override = postForm.value.platformContent?.[platform.platformType];
    const contentToValidate = override?.content ?? postForm.value.content;
    const commentsToValidate = override?.comments ?? platformSettingsState.masterComments.value; // Using masterComments directly for fallback

    // Use the new validation composable
    const result = validatePlatform(
      platform.platformType,
      contentToValidate,
      masterMedia.value,
      commentsToValidate
    );
    status[platform.accountId] = {
      isValid: result.status === 'valid',
      errors: result.messages.filter(m => m.status === 'error').map(item => item.message),
      warnings: result.messages.filter(m => m.status === 'warning').map(item => item.message)
    };
  });

  return status;
});
const revertToMaster = () => {
  explicitPreviewPlatform.value = "default";
};

const currentPlatformConfig = computed(() => {
  if (explicitPreviewPlatform.value === 'default') {
    return platformConfigurations['default'];
  }
  return platformConfigurations[explicitPreviewPlatform.value] || platformConfigurations['default'];
});

/* Ai related need to move  */
const { rewriteContent, fixGrammar, generateHashtags, smartSplit, isLoading: aiLoading, customPrompt } = useAI();
const handleAIAction = async (action: string, prompt?: string) => {
  const content = postForm.value.content;

  if (!content && !prompt) return;
  try {
    let result;
    switch (action) {
      case 'rewrite-professional':
        result = await rewriteContent(content, 'professional');
        if (result) postForm.value.content = result;
        break;
      case 'rewrite-fun':
        result = await rewriteContent(content, 'fun');
        if (result) postForm.value.content = result;
        break;
      case 'rewrite-concise':
        result = await rewriteContent(content, 'concise');
        if (result) postForm.value.content = result;
        break;
      case 'fix-grammar':
        result = await fixGrammar(content);
        if (result) postForm.value.content = result;
        break;
      case 'generate-hashtags':
        const hashtags = await generateHashtags(content);
        if (hashtags) postForm.value.content += `\n\n${hashtags.join(' ')}`;
        break;
      case 'smart-split':
        const thread = await smartSplit(content, postForm.value.targetPlatforms.map(platform => platform.platformType));
        if (thread && thread.length > 0) {
          postForm.value.content = thread[0];
          postForm.value.comment = thread.slice(1);
        }
      case 'custom-prompt':
        result = await customPrompt(`Content:${content} - User Prompt:${prompt}`);
        if (result) postForm.value.content = result;
        break;
    }
  } catch (error) {
    toast.add({
      title: 'AI Error',
      description: 'Failed to process AI request',
      color: 'error'
    });
  }
};

const handleTemplateAction = async (templateContent: string) => {
  const content = postForm.value.content;

  if (!content) {
    toast.add({
      icon: 'i-heroicons-exclamation-triangle',
      title: 'Content Error',
      description: 'Content is required',
      color: "error"
    });
    return;
  };
  try {
    if (!activeBusinessId.value || !businesses.value.data) {
      toast.add({
        icon: 'i-heroicons-exclamation-triangle',
        title: 'Business Error',
        description: 'Business is required',
        color: "error"
      });
      return;
    }
    const activeBusiness = businesses.value.data.find(b => b.isActive);
    console.log(activeBusiness);
    const finalContent = templateContent.replaceAll('{POSTCONTENT}', content).replaceAll('{BUSSINESID}', activeBusiness?.name || 'MagicSync');
    const result = await customPrompt(finalContent);

  } catch (error) {
    toast.add({
      icon: 'i-heroicons-exclamation-triangle',
      title: 'Template Error',
      description: `${error}`,
      color: "error"
    });
  }
};
/*
Emoji related
 */
const handleEmojiSelect = (emoji: string) => {
  postForm.value.content += emoji;
};
/* Variable related */
const handleVariableAction = (variable: string) => {
  postForm.value.content += variable;
};
</script>

<template>
  <section class="md:min-w-4xl">
    <UCard>
      <div class="flex items-center justify-between">
        <PostPlatformSelector :accounts="connectedSocialAccountsList" :selectedAccounts="selectedSocialMediaAccounts"
          @toggle="togglePlatform" :validationStatus="validationStatus" />
        <UButton color="neutral" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1"
          @click="emit('close')" />
      </div>

      <div class="md:flex flex-col lg:flex-row h-full">
        <!-- Left Side: Editor and Comments -->
        <div class="flex-1 p-4 border-r border-gray-200 dark:border-gray-800">
          <UTabs :items="tabs" variant="link" :ui="{ trigger: 'grow' }" class="gap-4 w-full">

            <template #editor>
              <div class="py-3">
                <div class="flex items-center justify-between">
                  <PostContextSwitcher v-model="explicitPreviewPlatform" :tabs="contextTabs"
                    :currentPlatformConfig="currentPlatformConfig" />
                  <UButton v-if="explicitPreviewPlatform !== 'default'" @click="revertToMaster" variant="ghost"
                    color="neutral" class="text-xs  hover:text-red-400 flex items-center gap-1 transition-colors">
                    <Icon name="lucide:rotate-ccw" class="w-3 h-3" />
                    {{ t('create_post.revert_to_master') }}
                  </UButton>
                </div>
                <div
                  class=" border border-muted  rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/10 transition-all mt-2">
                  <div v-if="explicitPreviewPlatform !== 'default'"
                    class=" px-4 py-2  border-primary/20 flex items-center gap-2">
                    <Icon name="lucide:info" class="w-4 h-4 text-indigo-400" />
                    <span class="text-xs text-indigo-300"
                      v-html="t('create_post.editing_platform_only', { platform: `<strong>${activeContextLabel}</strong>` })"></span>
                  </div>

                  <PostContentEditor v-model="currentContent" :character-count="currentContent.length"
                    :max-characters="currentPlatformConfig.maxPostLength"
                    :placeholder="`Drafting for ${activeContextLabel}...`">
                    <TemplateVariablePopUp @action="handleVariableAction" />
                    <template #ai-tools>
                      <PostAIAssistant :loading="aiLoading" @action="handleAIAction"
                        @template-action="handleTemplateAction" />
                    </template>
                    <template #emoji>
                      <EmojiPicker @select="handleEmojiSelect" />
                    </template>
                    <template #assetsList>
                      <section v-for="asset in postMediaAssets">
                        <img :src="asset.url" :alt="asset.filename" class="size-20 rounded-2xl">
                      </section>
                    </template>
                  </PostContentEditor>
                </div>

                <!-- Post Format Selector -->
                <PostFormatSelector v-model="postForm.postFormat"
                  :platforms="postForm.targetPlatforms.map(p => p.platformType)" class="mt-4" />

                <!-- Platform-Specific Settings Panel -->
                <PlatformSettingsPanel v-if="postForm.platformSettings" v-model="postForm.platformSettings"
                  :platform="explicitPreviewPlatform" />

                <div class="mt-4">
                  <h4 class="text-sm font-semibold mb-2">{{ t('newPostModal.commentsTitle') }}</h4>
                  <div v-for="(comment, index) in currentComments" :key="index" class="flex items-center gap-2 mb-2">
                    <UTextarea :model-value="currentComments[index]" @update:model-value="updateComment(index, $event)"
                      :placeholder="t('newPostModal.commentPlaceholder', { index: index + 1 })" :rows="8"
                      color="neutral" variant="none"
                      class="w-full flex-1 bg-transparent resize-none focus:ring-0 p-4 text-lg text-zinc-100 border border-muted rounded-2xl placeholder-zinc-600 scrollbar-hide" />
                    <UButton v-if="currentComments.length > 0" icon="i-heroicons-trash-20-solid" color="error"
                      variant="ghost" @click="removeComment(index)" />
                  </div>
                  <UButton icon="i-heroicons-plus-circle-20-solid" variant="ghost" @click="addComment">
                    {{ t('newPostModal.addComment') }}
                  </UButton>
                </div>
              </div>
            </template>
            <template #media>
              <p>{{ t('newPostModal.mediaLibraryContent') }}</p>
              <MediaGalleryForUser v-model:selected="postMediaAssets" />
            </template>

          </UTabs>
        </div>

        <!-- Right Side: Preview -->
        <div class=" p-4">
          <PhonePreview :postContent="formatPostContent(postForm.content, currentPreviewPlatform)"
            :mediaAssets="postMediaAssets" :platform="currentPreviewPlatform"
            :post="(postForm as unknown as PostCreateBase)" :currentPlatformConfig="currentPlatformConfig"
            v-model:format="selectedPostFormat" />
        </div>
      </div>
      <!-- Bottom -->
      <div class="border-t border-gray-200 dark:border-gray-800 pt-4 flex justify-center">
        <UPopover>
          <UButton icon="i-heroicons-calendar" variant="ghost">
            <span class="text-sm cursor-pointer hover:text-primary">
              {{ formattedScheduledAt }}
            </span>
          </UButton>
          <template #content>
            <div class="p-4 space-y-4">
              <UCalendar v-model="selectedDate" :is-date-unavailable="isDateUnavailable" />
              <UInput v-model="selectedTime" type="time" />
            </div>
          </template>
        </UPopover>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton :disabled="haveAtLeastOneAccountSelected" color="secondary" variant="outline"
            @click="handleSavePost('pending')">
            {{ t('newPostModal.saveDraft') }}
          </UButton>
          <UButton color="primary" variant="outline" @click="handleSavePost('published')"
            :disabled="haveAtLeastOneAccountSelected">
            {{ t('newPostModal.postNow') }}
          </UButton>
          <UButton color="warning" variant="ghost" @click="handleSavePost('pending')"
            :disabled="haveAtLeastOneAccountSelected">
            {{ t('newPostModal.schedule') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </section>
</template>
<style scoped></style>
