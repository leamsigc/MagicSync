<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio'
import StudioColorField from './StudioColorField.vue'
import { FONT_MANIFEST } from '../../../../shared/image-editor/fonts-manifest'

/**
 * Variables panel — {@name} bindings on the document plus live value
 * application. The same fields the render/batch API consumes.
 */

interface VariableRow {
  name: string
  properties: string[]
  targets: number
  objectIds: string[]
}

const { t } = useI18n()
const { editor } = useFabricJs()
const studio = useDesignStudio()

const fields = ref<VariableRow[]>([])
const draftValues = ref<Record<string, string>>({})
const editing = ref<string | null>(null)
const labelByProperty: Record<string, string> = {
  text: 'studio.fieldProp.text',
  image_url: 'studio.fieldProp.image_url',
  color: 'studio.fieldProp.color',
  font_family: 'studio.fieldProp.font',
  font_size: 'studio.fieldProp.font',
  visible: 'studio.fieldProp.visible',
  video_url: 'studio.fieldProp.video_url',
}

const fontOptions = FONT_MANIFEST.map(entry => ({ label: entry.family, value: entry.family }))

const VAR_PROPERTIES = ['text', 'image_url', 'color', 'font_family', 'font_size', 'visible'] as const
type VarProperty = typeof VAR_PROPERTIES[number]
type PropertyChoice = VarProperty | 'auto'

const propertyItems = computed(() => [
  { label: t('studio.variables.auto'), value: 'auto' },
  ...VAR_PROPERTIES.map(property => ({
    label: t(labelByProperty[property] ?? 'studio.fieldProp.text'),
    value: property,
  })),
])

const newVarName = ref('')
const newVarProperty = ref<PropertyChoice>('auto')
const bindProperty = ref<PropertyChoice>('auto')

const activeLayer = computed(() => editor?.value?.activeLayer?.value as { type?: string } | undefined)

function propertyOrUndefined(choice: PropertyChoice): VarProperty | undefined {
  return choice === 'auto' ? undefined : choice
}

/** Turn the selected layer (text/image/shape) into a variable binding. */
function createVariable(): void {
  const name = newVarName.value.trim()
  if (!name) {
    useToast().add({ title: t('studio.variables.nameRequired'), color: 'warning', icon: 'i-lucide-braces' })
    return
  }
  const plugin = editor.value?.getPlugin?.('studio') as
    { createVariableFromSelection?: (name: string, property?: VarProperty) => boolean } | undefined
  const ok = plugin?.createVariableFromSelection?.(name, propertyOrUndefined(newVarProperty.value)) ?? false
  if (!ok) {
    useToast().add({ title: t('studio.variables.noSelection'), color: 'warning', icon: 'i-lucide-mouse-pointer-square-dashed' })
    return
  }
  useToast().add({ title: t('studio.variables.created', { name }), color: 'success', icon: 'i-lucide-braces' })
  newVarName.value = ''
  refresh()
}

/** Bind the selected layer to an existing variable property. */
function bindSelected(field: VariableRow): void {
  const plugin = editor.value?.getPlugin?.('studio') as
    { bindSelectionToVariable?: (name: string, property?: VarProperty) => boolean } | undefined
  const ok = plugin?.bindSelectionToVariable?.(field.name, propertyOrUndefined(bindProperty.value)) ?? false
  useToast().add({
    title: ok ? t('studio.variables.bound', { name: field.name }) : t('studio.variables.noSelection'),
    color: ok ? 'success' : 'warning',
    icon: 'i-lucide-link',
  })
  if (ok) refresh()
}

/** Remove the active layer from this variable without deleting the variable. */
function unbindLayer(field: VariableRow): void {
  const plugin = editor.value?.getPlugin?.('studio') as
    { unbindSelectionFromVariable?: (name: string) => boolean } | undefined
  const ok = plugin?.unbindSelectionFromVariable?.(field.name) ?? false
  useToast().add({
    title: ok ? t('studio.variables.unlinked') : t('studio.variables.noSelection'),
    color: ok ? 'success' : 'warning',
    icon: 'i-lucide-link-2-off',
  })
  if (ok) refresh()
}

/** Delete the variable and clear all of its layer bindings. */
function removeVariable(field: VariableRow): void {
  const plugin = editor.value?.getPlugin?.('studio') as
    { deleteVariable?: (name: string) => boolean } | undefined
  plugin?.deleteVariable?.(field.name)
  delete draftValues.value[field.name]
  useToast().add({ title: t('studio.variables.deleted', { name: field.name }), color: 'success', icon: 'i-lucide-trash-2' })
  refresh()
}

async function refresh() {
  const plugin = editor.value?.getPlugin?.('studio') as
    { syncVariables?: () => { doc: { fields: Array<{ name: string; targets: Array<{ objectId: string; property: string }> }> } } } | undefined
  const synced = plugin?.syncVariables?.()
  if (!synced) {
    fields.value = []
    return
  }
  fields.value = synced.doc.fields.map(field => ({
    name: field.name,
    properties: [...new Set(field.targets.map(target => target.property))],
    targets: field.targets.length,
    objectIds: [...new Set(field.targets.map(target => target.objectId))],
  }))
}

const countedLabel = computed(() => t('studio.variables.count', { count: fields.value.length }))

function primaryProperty(field: VariableRow): string {
  return field.properties[0] ?? 'text'
}

function startEdit(field: VariableRow): void {
  editing.value = field.name
  draftValues.value = { ...draftValues.value, [field.name]: draftValues.value[field.name] ?? '' }
}

async function applyToCanvas(field: VariableRow): Promise<void> {
  const plugin = editor.value?.getPlugin?.('studio') as
    { applyVariable?: (name: string, values: Record<string, string | number | boolean>) => Promise<number> } | undefined
  const value = draftValues.value[field.name]
  if (!plugin || value === undefined) return
  const property = primaryProperty(field)
  const payload = property === 'visible'
    ? { visible: value !== 'false' }
    : property === 'font_size'
      ? { font_size: Number(value) || 16 }
      : { [property]: value }
  const touched = await plugin.applyVariable(field.name, payload)
  if (touched === 0) {
    useToast().add({ title: t('studio.variables.unbound'), color: 'warning', icon: 'i-lucide-link-2-off' })
    return
  }
  studio.markDirty()
  useToast().add({ title: t('studio.variables.applied', { count: touched }), color: 'success', icon: 'i-lucide-check' })
}

function selectBoundLayer(field: VariableRow): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  const ids = new Set(field.objectIds)
  const match = canvas.getObjects().find(obj => {
    const id = (obj as { id?: string }).id
    return typeof id === 'string' && ids.has(id)
  })
  if (!match) {
    useToast().add({ title: t('studio.variables.noLayer'), color: 'warning', icon: 'i-lucide-search-x' })
    return
  }
  canvas.setActiveObject(match)
  canvas.requestRenderAll()
}

/** Keep the default property aligned with the selected layer type. */
function setAutoProperty(): void {
  const type = activeLayer.value?.type
  if (type === 'image') newVarProperty.value = 'image_url'
  else if (type === 'textbox' || type === 'i-text' || type === 'text') newVarProperty.value = 'text'
}

onMounted(() => {
  setAutoProperty()
  refresh()
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-xs text-muted">{{ countedLabel }}</span>
      <UButton size="xs" variant="ghost" icon="lucide:refresh-ccw" :aria-label="t('studio.variables.refresh')" @click="refresh" />
    </div>

    <!-- create a variable from the selected layer -->
    <section class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.variables.createTitle') }}</h3>
      <UInput v-model="newVarName" size="xs" :placeholder="t('studio.variables.namePlaceholder')" @keydown.enter="createVariable" />
      <div class="flex gap-2">
        <USelect v-model="newVarProperty" :items="propertyItems" size="xs" class="flex-1" />
        <UButton size="xs" color="primary" variant="soft" icon="lucide:braces" @click="createVariable">
          {{ t('studio.variables.create') }}
        </UButton>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-muted shrink-0">{{ t('studio.variables.bindProperty') }}</span>
        <USelect v-model="bindProperty" :items="propertyItems" size="xs" class="flex-1" />
      </div>
    </section>

    <UAlert v-if="fields.length === 0" color="neutral" variant="soft" icon="i-lucide-braces" :title="t('studio.variables.empty.title')" :description="t('studio.variables.empty.desc')" />

    <div
      v-for="field in fields" :key="field.name"
      class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <button class="font-mono text-xs font-semibold text-highlighted truncate" type="button" @click="startEdit(field)">
          {{ field.name }}
        </button>
        <div class="flex items-center gap-1">
          <UBadge v-for="property in field.properties" :key="property" size="sm" variant="subtle" color="neutral">
            {{ t(labelByProperty[property] ?? 'studio.fieldProp.text') }}
          </UBadge>
          <UButton size="xs" variant="ghost" icon="lucide:link" :aria-label="t('studio.variables.bind')" @click="bindSelected(field)" />
          <UButton size="xs" variant="ghost" icon="lucide:crosshair" :aria-label="t('studio.variables.selectLayer')" @click="selectBoundLayer(field)" />
          <UButton size="xs" variant="ghost" color="warning" icon="lucide:unlink" :aria-label="t('studio.variables.unbind')" @click="unbindLayer(field)" />
          <UButton size="xs" variant="ghost" color="error" icon="lucide:trash-2" :aria-label="t('studio.variables.delete')" @click="removeVariable(field)" />
        </div>
      </div>

      <div class="text-[11px] text-muted">{{ t('studio.variables.targets', { count: field.targets }) }}</div>

      <template v-if="editing === field.name">
        <USelect
          v-if="primaryProperty(field) === 'font_family'"
          v-model="draftValues[field.name]"
          :items="fontOptions"
          size="xs" />
        <StudioColorField
          v-else-if="primaryProperty(field) === 'color'"
          v-model="draftValues[field.name]"
          testid="variable-color" />
        <UInput
          v-else
          v-model="draftValues[field.name]"
          size="xs"
          :type="primaryProperty(field) === 'image_url' ? 'url' : 'text'"
          :placeholder="t('studio.variables.valuePlaceholder')" />
      </template>

      <UButton
        size="xs" color="primary" variant="soft" block icon="lucide:wand-2"
        @click="applyToCanvas(field)">
        {{ t('studio.variables.apply') }}
      </UButton>
    </div>
  </div>
</template>
