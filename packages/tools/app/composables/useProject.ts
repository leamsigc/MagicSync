import TranscriptionWorker from '@/assets/workers/transcriptionWorker?worker'
import SummaryWorker from '@/assets/workers/summaryWorkers?worker'
/**
 *
 * Composable for Project management (CRUD operations)
 * Handles project creation, selection, deletion, and updates using IndexedDB
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */
import { saveProject, getProject, getAllProjects, deleteProject, type Project, type TranscriptionSegment } from '../utils/db'
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny'

const DEFAULT_MODEL_ID = 'onnx-community/whisper-tiny'

const extractAudio = async (file: File): Promise<{ buffer: Float32Array; duration: number }> => {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  })

  let duration = 0
  try {
    duration = await input.computeDuration()
  } catch (e) {
    console.warn('Mediabunny could not compute duration, falling back to AudioContext duration')
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
          sampleRate: 16000,
        })
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        const channelData = audioBuffer.getChannelData(0)
        resolve({ buffer: channelData, duration: duration || audioBuffer.duration })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

let transcriptionWorker: Worker | null = null

const getTranscriptionWorker = (): Worker => {
  if (!transcriptionWorker) {
    transcriptionWorker = new TranscriptionWorker()
  }
  return transcriptionWorker
}

export const useProject = () => {
  const projects = useState<Project[]>('projects', () => [])
  const activeProject = useState<Project | null>('activeProject', () => null)
  const isProcessing = useState('isProcessing', () => false)
  const processingProgress = useState('processingProgress', () => 0)
  const processingStatus = useState('processingStatus', () => '')
  const availableModels = useState<{ id: string; name: string; isMultilingual: boolean }[]>('availableModels', () => [])
  const isModelLoading = useState('isModelLoading', () => false)
  const modelLoadingProgress = useState('modelLoadingProgress', () => 0)
  const currentTranscriptionId = useState<string | null>('currentTranscriptionId', () => null)

  const loadProjects = async () => {
    const all = await getAllProjects()
    projects.value = all.sort((a, b) => b.lastModified - a.lastModified)
  }

  const initWorker = () => {
    const worker = getTranscriptionWorker()

    worker.onmessage = (e: MessageEvent) => {
      const { type, models, progress, status } = e.data

      if (type === 'models_list') {
        availableModels.value = models || []
        if (models && models.length > 0) {
          worker.postMessage({ type: 'init', model: models[0].id })
          isModelLoading.value = true
        }
      } else if (status === 'loading') {
        modelLoadingProgress.value = progress || 0
        isModelLoading.value = true
      } else if (type === 'ready') {
        isModelLoading.value = false
        modelLoadingProgress.value = 0
      }
    }

    worker.postMessage({ type: 'get_models' })

    return () => {
      worker.onmessage = null
    }
  }

  const addProject = async (file: File, model: string, language: string) => {
    isProcessing.value = true
    processingStatus.value = 'Extracting audio...'
    processingProgress.value = 0

    try {
      const { buffer, duration } = await extractAudio(file)
      const arrayBuffer = await file.arrayBuffer()

      const newProject: Project = {
        id: crypto.randomUUID(),
        filename: file.name,
        fileType: file.type,
        audioData: arrayBuffer,
        length: duration,
        status: 'pending',
        engine: model,
        language,
        lastModified: Date.now(),
        progress: 0,
      }

      await saveProject(newProject)
      await loadProjects()
      activeProject.value = { ...newProject }
      currentTranscriptionId.value = newProject.id

      startTranscription(newProject.id, buffer, model, language, duration)
      return newProject;
    } catch (err) {
      console.error(err)
      isProcessing.value = false
      processingStatus.value = 'Error extracting audio'
      currentTranscriptionId.value = null

      useToast().add({
        title: 'Error',
        description: 'Failed to extract audio from file',
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
    }
  }

  const startTranscription = (id: string, audioBuffer: Float32Array, model: string, language: string, duration: number) => {
    const worker = getTranscriptionWorker()
    currentTranscriptionId.value = id

    const handleMessage = async (e: MessageEvent) => {
      const { type, progress, segments, text, status, error, id: msgId } = e.data

      if (type === 'progress' || status === 'loading') {
        processingProgress.value = progress || 0
        processingStatus.value = 'Loading model...'
      } else if (type === 'ready') {
        processingStatus.value = 'Transcribing...'
        processingProgress.value = 5

        worker.postMessage({
          type: 'transcribe',
          audio: audioBuffer,
          language: language || 'en',
          id: id
        })

        const project = await getProject(id)
        if (project) {
          project.status = 'processing'
          await saveProject(project)
          activeProject.value = { ...project }
          await loadProjects()
        }
      } else if (type === 'chunk') {
        if (activeProject.value) {
          const updatedProject = {
            ...activeProject.value,
            segments: segments?.map((c: { id: number; text: string; start: number; end: number }, idx: number) => ({
              id: idx,
              text: c.text,
              start: c.start,
              end: c.end
            })) || []
          }
          activeProject.value = updatedProject

          if (duration > 0 && segments?.length > 0) {
            const lastEnd = segments[segments.length - 1].end
            const estimatedProgress = Math.min(99, (lastEnd / duration) * 100)
            processingProgress.value = estimatedProgress
          }
        }
      } else if (type === 'partial') {
        if (activeProject.value) {
          activeProject.value = {
            ...activeProject.value,
            partialText: text
          }
        }
        if (processingProgress.value < 95) {
          processingProgress.value = processingProgress.value + 0.5
        }
      } else if (type === 'complete') {
        const projectId = id
        const finalSegments = segments

        try {
          const project = await getProject(projectId)
          if (project) {
            project.status = 'completed'
            if (finalSegments && finalSegments.length > 0) {
              project.segments = finalSegments.map((c: { text: string; start: number; end: number }, idx: number) => ({
                id: idx,
                text: c.text,
                start: c.start,
                end: c.end
              }))
            }

            const text = finalSegments.map((c: { text: string }) => c.text).join(' ')
            project.partialText = text
            project.progress = 100

            await saveProject(project)
            activeProject.value = { ...project }

            useToast().add({
              title: 'Transcription Complete',
              description: `Transcription for "${project.filename}" has finished.`,
              color: 'success',
              icon: 'i-lucide-check-circle'
            })

            isProcessing.value = false
            processingStatus.value = ''

            worker.removeEventListener('message', handleMessage)

            if (finalSegments && finalSegments.length > 0) {
              const text = finalSegments.map((c: { text: string }) => c.text).join(' ')
              setTimeout(() => {
                startSummary(projectId, text)
              }, 100)
            }
          } else {
            worker.removeEventListener('message', handleMessage)
            isProcessing.value = false
            processingStatus.value = ''
          }
        } catch (err) {
          console.error('Error saving completed transcription:', err)
          worker.removeEventListener('message', handleMessage)
          isProcessing.value = false
          processingStatus.value = 'Error saving transcription'
        }
      } else if (type === 'error') {
        console.error('Transcription error:', error)
        const project = await getProject(id)
        if (project) {
          project.status = 'error'
          await saveProject(project)
          activeProject.value = { ...project }
        }
        isProcessing.value = false
        processingStatus.value = error || 'Error transcribing'

        useToast().add({
          title: 'Transcription Error',
          description: error || 'An error occurred during transcription.',
          color: 'error',
          icon: 'i-lucide-alert-circle'
        })

        worker.removeEventListener('message', handleMessage)
      }
    }

    worker.addEventListener('message', handleMessage)
    worker.postMessage({
      type: 'init',
      model: model || DEFAULT_MODEL_ID
    })
  }

  const startSummary = (id: string, text: string) => {
    const worker = new SummaryWorker()

    worker.onmessage = async e => {
      const { type, summary, error } = e.data
      if (type === 'ready') {
        worker.postMessage({ type: 'summarize', text })
      } else if (type === 'complete') {
        const project = await getProject(id)
        if (project) {
          project.summary = summary
          project.summaryStatus = 'completed'
          await saveProject(project)
          await loadProjects()
          activeProject.value = project

          useToast().add({
            title: 'Summary Complete',
            description: 'AI summary has been generated for your transcription.',
            color: 'success',
            icon: 'i-lucide-sparkles'
          })
        }
        worker.terminate()
      } else if (type === 'error') {
        console.error('Summary error:', error)
        useToast().add({
          title: 'Summary Error',
          description: error || 'An error occurred while generating the summary.',
          color: 'error',
          icon: 'i-lucide-alert-circle'
        })
        worker.terminate()
      }
    }
    worker.postMessage({ type: 'init' })
  }

  const selectProject = async (id: string) => {
    const project = await getProject(id)
    if (project) {
      activeProject.value = project
    }
  }

  const removeProject = async (id: string) => {
    await deleteProject(id)
    await loadProjects()
    if (activeProject.value?.id === id) {
      activeProject.value = null
    }
  }

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const project = await getProject(id)
    if (project) {
      const updated = { ...project, ...updates, lastModified: Date.now() }
      await saveProject(updated)
      await loadProjects()
      activeProject.value = activeProject.value?.id === id ? updated : activeProject.value
    }
  }

  const preloadModel = (modelId: string) => {
    isModelLoading.value = true
    modelLoadingProgress.value = 0
    const worker = getTranscriptionWorker()

    worker.postMessage({
      type: 'change_model',
      model: modelId || DEFAULT_MODEL_ID
    })
  }

  const stopTranscription = async () => {
    const projectId = currentTranscriptionId.value

    if (transcriptionWorker) {
      transcriptionWorker.terminate()
      transcriptionWorker = null
    }

    if (projectId) {
      const project = await getProject(projectId)
      if (project && project.status === 'processing') {
        project.status = 'cancelled'
        await saveProject(project)
        if (activeProject.value?.id === projectId) {
          activeProject.value = { ...project }
        }
      }
    }

    isProcessing.value = false
    processingProgress.value = 0
    processingStatus.value = ''
    currentTranscriptionId.value = null

    useToast().add({
      title: 'Transcription Stopped',
      description: 'The transcription has been cancelled.',
      color: 'warning',
      icon: 'i-lucide-circle-stop'
    })
  }

  return {
    projects: projects,
    activeProject: activeProject,
    isProcessing: readonly(isProcessing),
    processingProgress: readonly(processingProgress),
    processingStatus: readonly(processingStatus),
    availableModels: availableModels,
    isModelLoading: readonly(isModelLoading),
    modelLoadingProgress: readonly(modelLoadingProgress),
    currentTranscriptionId: readonly(currentTranscriptionId),
    loadProjects,
    initWorker,
    addProject,
    selectProject,
    removeProject,
    updateProject,
    setActiveProject: (project: Project | null) => { activeProject.value = project },
    preloadModel,
    stopTranscription,
  }
}
