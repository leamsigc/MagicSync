<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const { layers, activeLayerId, settings, createNewLayer, deleteLayer, selectLayer, setStackingDirection } = useVideoCropper()
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-video" class="w-4 h-4 text-primary" />
          <span class="font-semibold text-sm text-highlighted">{{ t('editor.cameras') }}</span>
        </div>
        <UButton color="primary" variant="soft" size="xs" @click="()=> createNewLayer()">
          {{ t('editor.add_camera') }}
        </UButton>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3 bg-muted p-3 rounded-xl border border-default">
        <div class="flex flex-col">
          <span class="text-xs font-semibold text-highlighted">{{ t('editor.layout_orientation') }}</span>
          <span class="text-[10px] text-dimmed">{{ t('editor.layout_description') }}</span>
        </div>
        <div class="flex gap-bg-default p-1 rounded-lg">
          <UButton
            size="xs"
            :color="settings.stackingDirection === 'vertical' ? 'primary' : 'neutral'"
            :variant="settings.stackingDirection === 'vertical' ? 'solid' : 'ghost'"
            @click="setStackingDirection('vertical')"
          >
            {{ t('editor.vertical') }}
          </UButton>
          <UButton
            size="xs"
            :color="settings.stackingDirection === 'horizontal' ? 'primary' : 'neutral'"
            :variant="settings.stackingDirection === 'horizontal' ? 'solid' : 'ghost'"
            @click="setStackingDirection('horizontal')"
          >
            {{ t('editor.horizontal') }}
          </UButton>
        </div>
      </div>

      <div class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        <div
          v-for="layer in layers"
          :key="layer.id"
          class="flex items-center justify-between p-3 rounded-xl border transition cursor-pointer"
          :class="layer.id === activeLayerId
            ? 'bg-muted border-(--ui-primary)/50'
            : 'bg-default border-default hover:border-accented'"
          @click="selectLayer(layer.id)"
        >
          <div class="flex items-center gap-3">
            <span class="w-3.5 h-3.5 rounded-full shrink-0" :style="{ backgroundColor: layer.color }"></span>
            <div>
              <span class="text-xs font-bold text-highlighted">{{ layer.name }}</span>
              <p class="text-[10px] font-mono text-dimmed mt-0.5">{{ t('editor.keyframes_count', { count: layer.keyframes.length }) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UBadge
              v-if="layer.id === activeLayerId"
              color="primary"
              variant="subtle"
              size="sm"
            >
              {{ t('editor.active_camera') }}
            </UBadge>
            <UButton
              v-if="layers.length > 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              @click.stop="deleteLayer(layer.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
