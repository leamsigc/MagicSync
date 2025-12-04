<!--  Translation file -->
<i18n src="../../posts.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Main text editor area with character count and toolbar
 */

interface Props {
  modelValue: string;
  placeholder?: string;
  characterCount: number;
  maxCharacters?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'What would you like to post?',
  maxCharacters: 2200,
  disabled: false
});

const { t } = useI18n();
const emit = defineEmits(['update:modelValue', 'attach-media', 'open-emoji', 'open-ai']);
const modelValue = defineModel<string>('modelValue');

const progressColor = computed(() => {
  const percentage = (props.characterCount / props.maxCharacters) * 100;
  if (percentage > 100) return 'text-red-500';
  if (percentage > 90) return 'text-orange-500';
  return 'text-zinc-500';
});
</script>

<template>
  <div class="relative flex flex-col h-full">
    <UTextarea v-model="modelValue" :placeholder="t('newPostModal.postPlaceholder')" :rows="8" :disabled="disabled"
      color="neutral" variant="none"
      class="w-full flex-1 bg-transparent border-none resize-none focus:ring-0 p-4 text-lg text-zinc-100 placeholder-zinc-600 scrollbar-hide">
    </UTextarea>

    <!-- Assets Preview -->

    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-3 ">
      <div class="flex items-center gap-2">
        <slot name="assetsList" />
      </div>
    </div>
    <div class="flex items-center justify-between px-4 py-3 border-t border-zinc-800/50">
      <div class="flex items-center gap-2">
        <UTooltip text="Attach Media">
          <button @click="emit('attach-media')"
            class="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <Icon name="lucide:paperclip" class="w-5 h-5" />
          </button>
        </UTooltip>

        <UTooltip text="Variables">
          <button class="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <Icon name="lucide:braces" class="w-5 h-5" />
          </button>
        </UTooltip>

        <div class="w-px h-6 bg-zinc-800 mx-1"></div>

        <slot name="ai-tools" />
        <slot name="emoji" />
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs font-medium" :class="progressColor">
          {{ characterCount }} chars
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
