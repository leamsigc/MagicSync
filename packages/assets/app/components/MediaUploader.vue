<script lang="ts" setup>
/**
 * Asset Uploader Component: Drag-and-drop file upload with progress tracking using Nuxt UI v4
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 1.0.0
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test
 * @todo [✔] Update the typescript
 * @todo [✔] Migrate to Nuxt UI v4 components
 * @todo [✔] Complete template structure and fix template issues
 */

interface Props {
  businessId?: string
  accept?: string
  maxSize?: number // in MB
  multiple?: boolean
  disabled?: boolean
  withPadding?: boolean
}

interface Emits {
  (e: 'upload', files: File[]): void
  (e: 'error', error: string): void
}

const props = withDefaults(defineProps<Props>(), {
  accept: 'image/*,video/*',
  maxSize: 10, // 10MB default
  multiple: true,
  disabled: false,
  withPadding: true
})

const emit = defineEmits<Emits>()

const { uploadFiles, uploadQueue } = useAssetManagement()
const { formatFileSize } = useAsset()

// Local state for UFileUpload v-model
const uploadValue = ref<File[] | null>(null)

// Local state for custom drop zone
const isDragOver = ref(false)
const isUploading = ref(false)

// Computed
const maxSizeBytes = computed(() => props.maxSize * 1024 * 1024)
const acceptedTypes = computed(() => props.accept.split(',').map(type => type.trim()))

// Methods
const validateFile = (file: File): string | null => {
  // Check file size
  if (file.size > maxSizeBytes.value) {
    return `File "${file.name}" is too large. Maximum size is ${props.maxSize}MB.`
  }

  // Check file type
  const isValidType = acceptedTypes.value.some(type => {
    if (type === '*/*') return true
    if (type.endsWith('/*')) {
      const category = type.split('/')[0]
      return file.type.startsWith(category + '/')
    }
    return file.type === type
  })

  if (!isValidType) {
    return `File "${file.name}" is not a supported file type.`
  }

  return null
}

const handleFilesUpload = async (files: File | File[] | null | undefined) => {
  const fileArray = Array.isArray(files) ? files : (files ? [files] : [])
  if (!fileArray.length) return

  isUploading.value = true

  const validFiles: File[] = []
  const errors: string[] = []

  // Validate each file
  for (const file of fileArray) {
    const error = validateFile(file)
    if (error) {
      errors.push(error)
    } else {
      validFiles.push(file)
    }
  }

  // Show errors if any
  if (errors.length > 0) {
    emit('error', errors.join('\n'))
    // Clear invalid files from UFileUpload
    uploadValue.value = null
    isUploading.value = false
    return
  }

  // Upload valid files
  if (validFiles.length > 0) {
    try {
      // Upload files
      console.log("Upload files");

      await uploadFiles(validFiles, props.businessId)
      emit('upload', validFiles)
      // Clear after successful upload
      uploadValue.value = null
    } catch (error: any) {
      emit('error', error.message || 'Upload failed')
      uploadValue.value = null
    } finally {
      isUploading.value = false
    }
  }
}

const removeFromQueue = (itemId: string) => {
  // Since uploadQueue is readonly, we need to emit an event to the parent component
  // to handle the removal instead of modifying it directly
  console.log(`Request to remove item ${itemId} from queue`)
  // In a real implementation, we would emit an event to the parent component
  // emit('removeFromQueue', itemId)
}

// Watch for upload queue changes to determine uploading state
watchEffect(() => {
  const queue = uploadQueue.value // Unwrap the ref
  const hasUploading = queue.some((item: any) =>
    item.status === 'uploading' ||
    item.status === 'pending'
  )
  const hasQueued = queue.some((item: any) => item.status === 'queued')

  isUploading.value = hasUploading || hasQueued
})
</script>

<template>
  <div class="asset-uploader grid content-center relative " :class="{ 'px-6': withPadding }">
    <!-- Main UFileUpload Component with Custom Slot -->
    <UFileUpload ref="uploadRef" v-model="uploadValue" :accept="accept" :multiple="multiple"
      :disabled="disabled || isUploading" variant="area" layout="list" :dropzone="true" :interactive="true" class="grid"
      @update:modelValue="handleFilesUpload">
      <template #default="{ open, removeFile }">
        <div
          class="absolute inset-0 bg-linear-to-br from-background/80 via-background/60 to-background/80 backdrop-blur-xl">
        </div>

        <!-- Animated Gradient Overlay -->
        <div
          class="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        </div>

        <!-- Premium Shimmer Effect -->
        <div class="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-700">
          <div
            class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer">
          </div>
        </div>

        <!-- Enhanced Floating Particles -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="floating-particle particle-1 bg-linear-to-br from-primary/30 to-primary/10"></div>
          <div class="floating-particle particle-2 bg-linear-to-br from-primary/25 to-primary/5"></div>
          <div class="floating-particle particle-3 bg-linear-to-br from-primary/20 to-transparent"></div>
          <div class="floating-particle particle-4 bg-linear-to-br from-primary/15 to-transparent"></div>
        </div>

        <!-- Drag Over Ripple Effect -->
        <div v-if="isDragOver" class="absolute inset-0 bg-primary/10 animate-ping rounded-xl"></div>

        <div class="relative z-10 p-12" @click="open()">
          <!-- Premium Upload Icon with Enhanced Animation -->
          <div class="mx-auto w-24 h-24 relative">
            <!-- Pulsing Background Ring -->
            <div class="absolute inset-0 bg-linear-to-br from-primary/20 to-primary/5 rounded-full animate-pulse-slow">
            </div>
            <div class="absolute inset-2 bg-linear-to-br from-primary/10 to-transparent rounded-full animate-pulse-slow"
              style="animation-delay: 0.5s;"></div>

            <!-- Icon Container -->
            <div class="relative flex items-center justify-center w-full h-full">
              <div
                class="absolute inset-0 bg-linear-to-br from-background/50 to-background/30 rounded-full backdrop-blur-sm border border-border/30">
              </div>
              <Icon v-if="isUploading" name="lucide:loader-2"
                class="w-12 h-12 text-primary animate-spin relative z-10" />
              <Icon v-else name="lucide:upload-cloud"
                class="w-12 h-12 text-primary group-hover:scale-110 transition-all duration-300 relative z-10 drop-shadow-lg" />
            </div>

            <!-- Success Ripple for Upload Complete -->
            <div v-if="uploadQueue.some(item => item.status === 'completed')"
              class="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
          </div>

          <!-- Elegant Upload Text with Enhanced Typography -->
          <div class="space-y-4 text-center">
            <h3
              class="text-3xl font-bold bg-linear-to-r from-foreground via-primary to-foreground/10 bg-clip-text text-transparent leading-tight">
              {{ isUploading ? 'Processing Your Assets...' : 'Drop Your Premium Assets Here' }}
            </h3>
            <p class="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              {{ multiple ? 'Select multiple files' : 'Select a file' }} up to {{ maxSize }}MB each for optimal quality
            </p>
            <div class="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-2">
              <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 backdrop-blur-sm">
                <Icon name="lucide:mouse-pointer-click" class="w-4 h-4" />
                <span>Click to browse</span>
              </div>
              <span class="text-muted-foreground/60">or</span>
              <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 backdrop-blur-sm">
                <Icon name="lucide:move" class="w-4 h-4" />
                <span>Drag & drop</span>
              </div>
            </div>
          </div>

          <!-- Enhanced File Type Badges -->
          <div class="flex flex-wrap justify-center gap-3">
            <UBadge v-for="(type, index) in [
              { name: 'Images', icon: 'lucide:image', formats: 'JPG, PNG, WebP' },
              { name: 'Videos', icon: 'lucide:video', formats: 'MP4, MOV, AVI' },
              { name: 'Documents', icon: 'lucide:file-text', formats: 'PDF, DOC, TXT' }
            ]" :key="type.name" variant="outline"
              class="glass-badge animate-fade-in-up hover-scale-105 transition-all duration-300 px-4 py-2 mb-2"
              :class="`animate-stagger-${index + 1}`">
              <Icon :name="type.icon" class="w-4 h-4 mr-2" />
              <div class="text-left">
                <div class="font-medium">{{ type.name }}</div>
                <div class="text-xs text-muted-foreground">{{ type.formats }}</div>
              </div>
            </UBadge>
          </div>

          <!-- Enhanced Upload Progress Indicator -->
          <div v-if="isUploading" class="w-full max-w-sm mx-auto space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Processing files...</span>
              <span class="text-primary font-medium">{{Math.round((uploadQueue.filter(item => item.status ===
                'completed').length / uploadQueue.length) * 100)}}%</span>
            </div>
            <div class="h-2 bg-muted/50 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                class="h-full bg-linear-to-r from-primary via-primary/80 to-primary/60 rounded-full transition-all duration-500 relative overflow-hidden"
                :style="{ width: `${(uploadQueue.filter(item => item.status === 'completed').length / uploadQueue.length) * 100}%` }">
                <div
                  class="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer">
                </div>
              </div>
            </div>
          </div>

          <!-- Premium Features Highlight -->
          <div class="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div class="flex items-center gap-1">
              <Icon name="lucide:shield-check" class="w-3 h-3 text-green-500" />
              <span>Secure Upload</span>
            </div>
            <div class="flex items-center gap-1">
              <Icon name="lucide:zap" class="w-3 h-3 text-yellow-500" />
              <span>Auto-Optimize</span>
            </div>
            <div class="flex items-center gap-1">
              <Icon name="lucide:cloud" class="w-3 h-3 text-blue-500" />
              <span>Cloud Storage</span>
            </div>
          </div>
        </div>


        <!-- Corner Accents -->
        <div
          class="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-primary/20 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        </div>
        <div
          class="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-primary/20 rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        </div>
        <div
          class="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-primary/20 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        </div>
        <div
          class="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-primary/20 rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        </div>
      </template>
    </UFileUpload>

    <!-- Elegant Upload Queue -->
    <div v-if="uploadQueue.length > 0" class="mt-8 space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-lg font-semibold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Upload Progress
        </h4>
        <UBadge variant="outline" class="glass-badge">
          {{uploadQueue.filter(item => item.status === 'completed').length}} / {{ uploadQueue.length }} completed
        </UBadge>
      </div>

      <div class="space-y-3">
        <div v-for="(item, index) in uploadQueue" :key="item.id" class="upload-item glass-card animate-fade-in-up"
          :class="`animate-stagger-${Math.min(index % 3 + 1, 3)}`">
          <!-- File Preview -->
          <div class="flex items-center gap-4 p-4">
            <div class="relative shrink-0">
              <!-- Status Icon with Animation -->
              <div
                class="w-12 h-12 rounded-lg bg-linear-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                <Icon v-if="item.status === 'completed'" name="lucide:check-circle"
                  class="w-6 h-6 text-green-500 animate-scale-in" />
                <Icon v-else-if="item.status === 'error'" name="lucide:x-circle"
                  class="w-6 h-6 text-red-500 animate-shake" />
                <Icon v-else-if="item.status === 'uploading'" name="lucide:loader-2"
                  class="w-6 h-6 text-primary animate-spin" />
                <Icon v-else name="lucide:file" class="w-6 h-6 text-muted-foreground" />

                <!-- Success Ripple Effect -->
                <div v-if="item.status === 'completed'"
                  class="absolute inset-0 bg-green-500/20 rounded-lg animate-ping">
                </div>
              </div>

              <!-- Status Badge -->
              <div class="absolute -top-1 -right-1">
                <UBadge :variant="item.status === 'completed' ? 'solid' : item.status === 'error' ? 'solid' : 'subtle'"
                  class="text-xs px-1.5 py-0.5 glass-badge">
                  {{ item.status === 'completed' ? '✓' : item.status === 'error' ? '✗' : '...' }}
                </UBadge>
              </div>
            </div>

            <!-- File Details -->
            <div class="flex-1 min-w-0 space-y-2 max-w-full">
              <div class="flex items-center justify-between ">
                <h5 class="font-medium truncate text-sm max-w-32 md:max-w-full">{{ item.file.name }}</h5>
                <span class="text-xs text-muted-foreground">{{ formatFileSize(item.file.size) }}</span>
              </div>

              <!-- Elegant Progress Bar -->
              <div v-if="item.status === 'uploading'" class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-muted-foreground">Uploading...</span>
                  <span class="text-primary font-medium">{{ item.progress.percentage }}%</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    class="h-full bg-linear-to-r from-primary to-primary/60 rounded-full transition-all duration-300 ease-out"
                    :style="{ width: `${item.progress.percentage}%` }">
                    <div class="h-full bg-white/20 animate-shimmer"></div>
                  </div>
                </div>
              </div>

              <!-- Success Message -->
              <div v-else-if="item.status === 'completed'" class="text-xs text-green-600 font-medium">
                <Icon name="lucide:check" class="w-3 h-3 inline mr-1" />
                Upload completed successfully
              </div>

              <!-- Error Message -->
              <div v-else-if="item.status === 'error' && item.error" class="text-xs text-red-600">
                <Icon name="lucide:alert-circle" class="w-3 h-3 inline mr-1" />
                {{ item.error }}
              </div>
            </div>

            <!-- Action Button -->
            <UButton variant="ghost" size="sm" class="glass-button hover-scale-105 flex-shrink-0"
              @click="removeFromQueue(item.id)">
              <Icon name="lucide:x" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
