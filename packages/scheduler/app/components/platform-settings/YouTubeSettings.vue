<script lang="ts" setup>
import type { YouTubeSettings } from '#layers/BaseScheduler/shared/platformSettings';
import type { Asset } from '#layers/BaseDB/db/schema';

const settings = defineModel<YouTubeSettings>({ required: true });
const props = defineProps<{ mediaAssets?: Asset[] }>();

const privacyOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Unlisted', value: 'unlisted' },
  { label: 'Private', value: 'private' },
];

const categories = [
  { label: 'Film & Animation', value: '1' },
  { label: 'Autos & Vehicles', value: '2' },
  { label: 'Music', value: '10' },
  { label: 'Pets & Animals', value: '15' },
  { label: 'Sports', value: '17' },
  { label: 'Travel & Events', value: '19' },
  { label: 'Gaming', value: '20' },
  { label: 'People & Blogs', value: '22' },
  { label: 'Comedy', value: '23' },
  { label: 'Entertainment', value: '24' },
  { label: 'News & Politics', value: '25' },
  { label: 'Howto & Style', value: '26' },
  { label: 'Education', value: '27' },
  { label: 'Science & Technology', value: '28' },
  { label: 'Nonprofits & Activism', value: '29' },
];

const imageAssets = computed(() => props.mediaAssets?.filter(a => a.mimeType.startsWith('image/')) || []);

const selectedThumbnailIndex = computed({
  get: () => {
    if (!settings.value.thumbnailUrl) return -1;
    return imageAssets.value.findIndex(a => a.url === settings.value.thumbnailUrl);
  },
  set: (index: number) => {
    settings.value.thumbnailUrl = index >= 0 ? imageAssets.value[index]?.url : undefined;
  }
});

const tagsString = computed({
  get: () => settings.value.tags?.join(', ') || '',
  set: (val: string) => {
    settings.value.tags = val.split(',').map(t => t.trim()).filter(Boolean);
  }
});
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Post Type" hint="Choose what type of YouTube content to create" required>
      <div class="grid grid-cols-3 gap-2">
        <button type="button"
          class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all cursor-pointer"
          :class="settings.postType === 'video' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border hover:border-muted'"
          @click="settings.postType = 'video'">
          <Icon name="lucide:video" class="w-5 h-5" />
          <span class="text-xs font-medium">Video</span>
          <span class="text-[10px] text-muted">Long-form</span>
        </button>
        <button type="button"
          class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all cursor-pointer"
          :class="settings.postType === 'short' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border hover:border-muted'"
          @click="settings.postType = 'short'">
          <Icon name="lucide:smartphone" class="w-5 h-5" />
          <span class="text-xs font-medium">Short</span>
          <span class="text-[10px] text-muted">Vertical &lt;60s</span>
        </button>
        <button type="button"
          class="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all cursor-pointer"
          :class="settings.postType === 'post' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border hover:border-muted'"
          @click="settings.postType = 'post'">
          <Icon name="lucide:message-square" class="w-5 h-5" />
          <span class="text-xs font-medium">Community Post</span>
          <span class="text-[10px] text-muted">Text &amp; images</span>
        </button>
      </div>
    </UFormField>

    <template v-if="settings.postType !== 'post'">
      <UFormField label="Video Title" hint="Required – displayed as the video title on YouTube" required>
        <UInput v-model="settings.title" placeholder="Enter a compelling video title" />
      </UFormField>

      <UFormField label="Description" hint="Uses your post content as the video description">
        <p class="text-xs text-muted">The description will be taken from the post content editor above.</p>
      </UFormField>

      <UFormField label="Privacy Status">
        <USelect v-model="settings.privacyStatus" :items="privacyOptions" placeholder="Select privacy status" />
      </UFormField>

      <UFormField label="Made for Kids">
        <div class="flex items-center gap-2">
          <UToggle v-model="settings.madeForKids" />
          <span class="text-xs text-muted">{{ settings.madeForKids ? 'Yes – content is made for children' : 'No – content is not specifically made for children' }}</span>
        </div>
      </UFormField>

      <UFormField label="Tags" hint="Comma-separated keywords to help viewers discover your video">
        <UInput v-model="tagsString" placeholder="tag1, tag2, tag3" />
      </UFormField>

      <UFormField label="Category">
        <USelect v-model="settings.categoryId" :items="categories" placeholder="Select a category" />
      </UFormField>

      <UFormField label="Thumbnail" hint="Select an image from your post media to use as the video thumbnail">
        <div v-if="imageAssets.length === 0" class="text-xs text-muted p-2 border border-dashed border-muted rounded-lg">
          No images in your post. Add an image in the Media tab to use as a thumbnail.
        </div>
        <div v-else class="grid grid-cols-4 gap-2">
          <button
            v-for="(img, idx) in imageAssets"
            :key="img.id"
            type="button"
            class="relative aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer"
            :class="selectedThumbnailIndex === idx ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted'"
            @click="selectedThumbnailIndex = idx"
          >
            <img :src="img.thumbnailUrl || img.url" :alt="img.originalName" class="w-full h-full object-cover" />
            <div v-if="selectedThumbnailIndex === idx" class="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <Icon name="lucide:check-circle" class="w-6 h-6 text-primary" />
            </div>
          </button>
        </div>
      </UFormField>
    </template>

    <template v-else>
      <div class="p-4 border border-dashed border-muted rounded-lg">
        <p class="text-sm text-muted text-center">
          Community posts use text and images — no video required.
          The post content will be published as a community update on your YouTube channel.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped></style>
