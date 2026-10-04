<!--  Translation file -->
<i18n src="#site/app/pages/app/calendar/calendar.json"></i18n>

<script lang="ts" setup>
import NewPostModal from '../../posts/components/NewPostModal.vue'
/**
 * Component Description: Asset Page Header with Navigation and Actions
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 */



interface Emits {
  createNewPost: []
}
const emit = defineEmits<Emits>()
const { t } = useI18n()
</script>

<template>
  <BasePageHeader :title="t('title')" :description="t('description')">
    <template #actions>
      <UButton color="neutral" variant="ghost" to="/app/posts">
        <Icon name="lucide:layout-dashboard" class="md:mr-2 h-4 w-4" />
        <div class="hidden md:inline">
          {{ t('buttons.dashboard') }}
        </div>
      </UButton>
      <UButton color="neutral" variant="ghost" to="/app/calendar/weeks">
        <Icon name="lucide:calendar-days" class="md:mr-2 h-4 w-4" />
        <div class="hidden md:inline">
          {{ t('buttons.week') }}
        </div>
      </UButton>
      <UButton color="neutral" variant="ghost" to="/app/calendar/month">
        <Icon name="lucide:calendar" class="md:mr-2 h-4 w-4" />
        <div class="hidden md:inline">
          {{ t('buttons.month') }}
        </div>
      </UButton>
      <NewPostModal>
        <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
          <slot name="mic-recorder" v-bind="slotProps" />
        </template>
        <template v-if="$slots['template-variable']" #template-variable="slotProps">
          <slot name="template-variable" v-bind="slotProps" />
        </template>
        <template v-if="$slots['ai-assistant']" #ai-assistant="slotProps">
          <slot name="ai-assistant" v-bind="slotProps" />
        </template>
      </NewPostModal>
    </template>
  </BasePageHeader>
</template>
