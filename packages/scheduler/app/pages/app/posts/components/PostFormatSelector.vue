<script lang="ts" setup>
/**
 *
 * Component Description: Post format selector based on platform capabilities
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { platformConfigurations, type PostFormat, type SocialMediaPlatformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';

type Props = {
  platforms: Array<keyof SocialMediaPlatformConfigurations>;
};

const props = defineProps<Props>();
const modelValue = defineModel<PostFormat>({ default: 'post' });

const formatOptions = [
  { label: 'Regular Post', value: 'post', icon: 'lucide:file-text' },
  { label: 'Story', value: 'story', icon: 'lucide:smartphone' },
  { label: 'Reel/Short', value: 'reel', icon: 'lucide:video' },
];

const availableFormats = computed(() => {
  if (props.platforms.length === 0) {
    return formatOptions;
  }

  const supportedByAll = formatOptions.filter(format => {
    return props.platforms.every(platform => {
      const config = platformConfigurations[platform];
      if (!config) return false;
      return config.supportedFormats?.includes(format.value as PostFormat) ?? format.value === 'post';
    });
  });

  return supportedByAll.length > 0 ? supportedByAll : [formatOptions[0]];
});

const isFormatDisabled = (format: string): boolean => {
  return !availableFormats.value.some(f => f?.value === (format as PostFormat));
};
</script>

<template>
  <div class="space-y-2">
    <label class="text-sm font-medium text-muted-foreground">Post Format</label>
    <div class="flex gap-2">
      <UButton v-for="format in formatOptions" :key="format.value" :icon="format.icon"
        :variant="modelValue === format.value ? 'solid' : 'outline'" :disabled="isFormatDisabled(format.value)"
        size="sm" @click="modelValue = (format.value as PostFormat)">
        <span class="hidden md:block">
          {{ format.label }}
        </span>
      </UButton>
    </div>
    <p v-if="platforms.length > 0" class="text-xs text-muted">
      Available formats based on {{ platforms.length }} selected platform{{ platforms.length > 1 ? 's' : '' }}
    </p>
  </div>
</template>

<style scoped></style>
