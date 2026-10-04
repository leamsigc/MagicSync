<i18n src="#site/app/pages/tools/og-image-generator/index.json"></i18n>

<script lang="ts" setup>
import { makeLayer, OG_PLATFORMS, type OgLayer, type OgPlatform } from '../../../composables/tools/og-image-generator/og-model'
import { useOgDoc } from '../../../composables/tools/og-image-generator/useOgDoc'
import OgScaledStage from './OgScaledStage.vue'
import OgDock from './OgDock.vue'
import OgMediaPicker from './OgMediaPicker.vue'

const props = defineProps<{
  platform: OgPlatform
}>()

const { t } = useI18n()
const doc = useOgDoc()
const layers = computed(() => doc.value.layers)

const leftDock = ref<string | null>('layers')
const rightDock = ref<string | null>(null)
const stageRef = ref<{ scale: number } | null>(null)

const selectedId = ref<string | null>(layers.value.at(-1)?.id ?? null)
const selectedLayer = computed(() => layers.value.find(l => l.id === selectedId.value) || null)

const leftItems = [
  { key: 'layers', icon: 'i-lucide-layers', label: t('layers') },
  { key: 'add', icon: 'i-lucide-plus', label: t('add') }
]
const rightItems = [
  { key: 'properties', icon: 'i-lucide-settings-2', label: t('properties') },
  { key: 'size', icon: 'i-lucide-proportions', label: t('size') }
]

const addLayer = (type: 'text' | 'rect' | 'image') => {
  const layer = makeLayer({
    type,
    name: type === 'text' ? t('layer_text') : type === 'rect' ? t('layer_rect') : t('layer_image'),
    x: Math.round(props.platform.width * 0.1),
    y: Math.round(props.platform.height * 0.35),
    width: type === 'rect' ? Math.round(props.platform.width * 0.4) : Math.round(props.platform.width * 0.5),
    height: type === 'image' ? Math.round(props.platform.height * 0.5) : type === 'rect' ? Math.round(props.platform.height * 0.2) : Math.round(props.platform.height * 0.15),
    content: type === 'text' ? t('new_text_layer') : '',
    fill: '#22d3ee',
    fontSize: Math.round(props.platform.width / 18)
  })
  layers.value.push(layer)
  selectedId.value = layer.id
}

const removeLayer = (id: string) => {
  const index = layers.value.findIndex(l => l.id === id)
  if (index !== -1) {
    layers.value.splice(index, 1)
    if (selectedId.value === id) selectedId.value = null
  }
}

const moveLayer = (id: string, direction: -1 | 1) => {
  const index = layers.value.findIndex(l => l.id === id)
  const target = index + direction
  if (index === -1 || target < 0 || target >= layers.value.length) return
  const [layer] = layers.value.splice(index, 1)
  if (layer) layers.value.splice(target, 0, layer)
}

const duplicateLayer = (id: string) => {
  const source = layers.value.find(l => l.id === id)
  if (!source) return
  const copy: OgLayer = { ...source, id: Math.random().toString(36).slice(2, 10), name: `${source.name} ${t('copy_suffix')}`, x: source.x + 24, y: source.y + 24 }
  layers.value.push(copy)
  selectedId.value = copy.id
}

// Drag to move (pointer events, compensated for preview scale)
let dragging: { id: string, startX: number, startY: number, origX: number, origY: number } | null = null

const onPointerDown = (event: PointerEvent, layer: OgLayer) => {
  selectedId.value = layer.id
  dragging = {
    id: layer.id,
    startX: event.clientX,
    startY: event.clientY,
    origX: layer.x,
    origY: layer.y
  }
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
}

const onPointerMove = (event: PointerEvent) => {
  if (!dragging) return
  const layer = layers.value.find(l => l.id === dragging?.id)
  if (!layer) return
  const scale = stageRef.value?.scale ?? 1
  layer.x = Math.max(0, Math.min(props.platform.width - 40, Math.round(dragging.origX + (event.clientX - dragging.startX) / scale)))
  layer.y = Math.max(0, Math.min(props.platform.height - 40, Math.round(dragging.origY + (event.clientY - dragging.startY) / scale)))
}

const onPointerUp = () => {
  dragging = null
}

const numberField = (label: string, key: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'fontSize' | 'radius', max: number) => ({
  label,
  get: () => selectedLayer.value?.[key] ?? 0,
  set: (v: number) => { const layer = selectedLayer.value; if (layer) layer[key] = v },
  max
})

const transformFields = computed(() => [
  numberField('X', 'x', props.platform.width),
  numberField('Y', 'y', props.platform.height),
  numberField(t('width'), 'width', props.platform.width),
  numberField(t('height'), 'height', props.platform.height)
])
</script>

<template>
  <div class="relative">
    <OgScaledStage ref="stageRef" class="min-w-0" :width="platform.width" :height="platform.height">
      <div
        class="absolute inset-0 bg-neutral-950"
        :style="{ fontFamily: 'system-ui, sans-serif' }"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <div
          v-for="layer in layers"
          v-show="layer.visible"
          :key="layer.id"
          class="absolute cursor-move select-none"
          :class="selectedId === layer.id ? 'outline-2 outline-offset-2 outline-primary outline-dashed' : ''"
          :style="{
            left: `${layer.x}px`,
            top: `${layer.y}px`,
            width: `${layer.width}px`,
            height: layer.type === 'text' ? 'auto' : `${layer.height}px`,
            minHeight: layer.type === 'text' ? `${layer.height}px` : undefined,
            transform: `rotate(${layer.rotation}deg)`,
            opacity: layer.opacity / 100
          }"
          @pointerdown="(e) => onPointerDown(e as PointerEvent, layer)"
        >
          <template v-if="layer.type === 'text'">
            <span
              class="block whitespace-pre-wrap break-words leading-tight"
              :style="{ fontSize: `${layer.fontSize}px`, fontWeight: layer.bold ? 700 : 400, fontStyle: layer.italic ? 'italic' : 'normal', color: layer.color }"
            >{{ layer.content }}</span>
          </template>
          <template v-else-if="layer.type === 'rect'">
            <div class="w-full h-full" :style="{ backgroundColor: layer.fill, borderRadius: `${layer.radius}px` }" />
          </template>
          <template v-else>
            <img v-if="layer.src" :src="layer.src" alt="" draggable="false" class="w-full h-full object-cover pointer-events-none" :style="{ borderRadius: `${layer.radius}px` }">
            <div v-else class="w-full h-full grid place-items-center bg-neutral-800/60 border border-dashed border-neutral-600 rounded-lg pointer-events-none">
              <Icon name="i-lucide-image-plus" class="opacity-40" />
            </div>
          </template>
        </div>

        <div v-if="layers.length === 0" class="absolute inset-0 grid place-items-center text-dimmed">
          {{ t('no_layers_hint') }}
        </div>
      </div>
    </OgScaledStage>

    <!-- Left floating dock: layers -->
    <OgDock v-model:active="leftDock" side="left" :items="leftItems">
      <template #layers>
        <p class="text-sm font-semibold">{{ t('layers') }}</p>
        <TransitionGroup name="layer" tag="ul" class="space-y-1">
          <li v-for="layer in [...layers].reverse()" :key="layer.id">
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              :class="selectedId === layer.id ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accented/60'"
              @click="() => { selectedId = layer.id }"
            >
              <Icon
                :name="layer.type === 'text' ? 'i-lucide-type' : layer.type === 'rect' ? 'i-lucide-square' : 'i-lucide-image'"
                class="shrink-0 opacity-70"
              />
              <span class="truncate flex-1 text-left" :class="{ 'line-through opacity-50': !layer.visible }">{{ layer.name }}</span>
              <UButton
                :icon="layer.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                variant="ghost" color="neutral" size="xs"
                @click.stop="() => { layer.visible = !layer.visible }"
              />
              <UButton icon="i-lucide-copy" variant="ghost" color="neutral" size="xs" @click.stop="() => { duplicateLayer(layer.id) }" />
              <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click.stop="() => { removeLayer(layer.id) }" />
            </button>
          </li>
        </TransitionGroup>
        <div class="flex justify-end gap-1">
          <UTooltip :text="t('move_up')">
            <UButton icon="i-lucide-arrow-up" size="xs" variant="ghost" color="neutral" :disabled="!selectedId" @click="() => { if (selectedId) moveLayer(selectedId, 1) }" />
          </UTooltip>
          <UTooltip :text="t('move_down')">
            <UButton icon="i-lucide-arrow-down" size="xs" variant="ghost" color="neutral" :disabled="!selectedId" @click="() => { if (selectedId) moveLayer(selectedId, -1) }" />
          </UTooltip>
        </div>
      </template>

      <template #add>
        <p class="text-sm font-semibold">{{ t('add') }}</p>
        <div class="grid grid-cols-3 gap-2">
          <UButton variant="soft" icon="i-lucide-type" :label="t('add_text')" class="justify-center" @click="() => addLayer('text')" />
          <UButton variant="soft" icon="i-lucide-square" :label="t('add_shape')" class="justify-center" @click="() => addLayer('rect')" />
          <UButton variant="soft" icon="i-lucide-image" :label="t('add_image')" class="justify-center" @click="() => addLayer('image')" />
        </div>
      </template>
    </OgDock>

    <!-- Right floating dock: properties + size -->
    <OgDock v-model:active="rightDock" side="right" :items="rightItems">
      <template #properties>
        <p class="text-sm font-semibold">{{ selectedLayer ? t('layer_properties') : t('properties') }}</p>

        <div v-if="selectedLayer" class="space-y-4">
          <UFormField :label="t('name')">
            <UInput v-model="selectedLayer.name" class="w-full" size="sm" />
          </UFormField>

          <USeparator label="Transform" type="dashed" />

          <div class="grid grid-cols-2 gap-2">
            <UFormField v-for="field in transformFields" :key="field.label" :label="field.label" size="xs">
              <UInput
                :model-value="field.get()"
                type="number"
                size="sm"
                class="w-full"
                @update:model-value="(v) => field.set(Number(v))"
              />
            </UFormField>
          </div>
          <UFormField :label="t('rotation')" size="xs">
            <USlider :model-value="selectedLayer.rotation" :min="-180" :max="180" @update:model-value="(v) => { if (selectedLayer) selectedLayer.rotation = Number(v) }" />
          </UFormField>
          <UFormField :label="t('opacity')" size="xs">
            <USlider :model-value="selectedLayer.opacity" :min="0" :max="100" @update:model-value="(v) => { if (selectedLayer) selectedLayer.opacity = Number(v) }" />
            <p class="text-xs text-muted mt-1">{{ selectedLayer.opacity }}%</p>
          </UFormField>

          <USeparator label="Style" type="dashed" />

          <template v-if="selectedLayer.type === 'text'">
            <UFormField :label="t('content')">
              <UTextarea v-model="selectedLayer.content" autoresize :rows="2" class="w-full" size="sm" />
            </UFormField>
            <div class="flex items-center gap-2">
              <UFormField :label="t('font_size')" size="xs" class="flex-1">
                <UInput v-model.number="selectedLayer.fontSize" type="number" size="sm" class="w-full" />
              </UFormField>
              <USwitch v-model="selectedLayer.bold" size="xs">
                <Icon name="i-lucide-bold" />
              </USwitch>
              <USwitch v-model="selectedLayer.italic" size="xs">
                <Icon name="i-lucide-italic" />
              </USwitch>
              <UColorPicker v-model="selectedLayer.color" size="sm" class="mt-4" />
            </div>
          </template>

          <template v-else-if="selectedLayer.type === 'rect'">
            <div class="flex items-center gap-3">
              <UFormField :label="t('fill')" size="xs" class="flex-1">
                <UColorPicker v-model="selectedLayer.fill" size="sm" class="w-full" />
              </UFormField>
              <UFormField :label="t('corner_radius')" size="xs" class="flex-1">
                <UInput v-model.number="selectedLayer.radius" type="number" size="sm" class="w-full" />
              </UFormField>
            </div>
          </template>

          <template v-else>
            <OgMediaPicker v-model="selectedLayer.src" :label="t('image_url')" />
          </template>
        </div>

        <div v-else class="text-sm text-muted py-6 text-center">
          <p>{{ t('select_layer_hint') }}</p>
          <div class="flex justify-center gap-2 mt-4">
            <UButton size="xs" variant="soft" icon="i-lucide-type" :label="t('add_text')" @click="() => addLayer('text')" />
            <UButton size="xs" variant="soft" icon="i-lucide-square" :label="t('add_shape')" @click="() => addLayer('rect')" />
            <UButton size="xs" variant="soft" icon="i-lucide-image" :label="t('add_image')" @click="() => addLayer('image')" />
          </div>
        </div>
      </template>

      <template #size>
        <p class="text-sm font-semibold">{{ t('size') }}</p>
        <div class="space-y-1">
          <button
            v-for="p in OG_PLATFORMS"
            :key="p.key"
            type="button"
            class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors"
            :class="doc.platform === p.key ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accented/60'"
            @click="() => { doc.platform = p.key }"
          >
            <span>{{ p.label }}</span>
            <span class="text-xs text-muted">{{ p.width }}×{{ p.height }}</span>
          </button>
        </div>
      </template>
    </OgDock>
  </div>
</template>

<style scoped>
.layer-enter-active,
.layer-leave-active {
  transition: all .18s ease;
}
.layer-enter-from,
.layer-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
