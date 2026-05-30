import { ref, computed, onUnmounted } from 'vue'

interface A2UIComponent {
  id: string
  component: string | Record<string, unknown>
  [key: string]: unknown
}

interface A2UIAction {
  action: string
  surfaceId: string
  componentId: string
  payload?: Record<string, unknown>
}

interface A2UIMessage {
  type: string
  components?: A2UIComponent[]
  path?: string
  value?: unknown
}

export function useA2UI() {
  const components = ref<A2UIComponent[]>([])
  const dataModel = ref<Record<string, unknown>>({})
  const isConnected = ref(false)
  const error = ref<Error | null>(null)

  let eventSource: EventSource | null = null

  function connect(url: string) {
    if (eventSource) {
      eventSource.close()
    }

    eventSource = new EventSource(url)
    isConnected.value = true

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch (e) {
        console.error('Failed to parse A2UI message:', e)
      }
    }

    eventSource.onerror = (e) => {
      error.value = new Error('SSE connection error')
      isConnected.value = false
      eventSource?.close()
    }
  }

  function handleMessage(data: A2UIMessage) {
    switch (data.type) {
      case 'createSurface':
      case 'beginRendering':
        components.value = []
        break
      case 'updateComponents':
      case 'surfaceUpdate':
        if (data.components) {
          for (const comp of data.components) {
            const idx = components.value.findIndex(c => c.id === comp.id)
            if (idx >= 0) {
              components.value[idx] = comp
            } else {
              components.value.push(comp)
            }
          }
        }
        break
      case 'updateDataModel':
      case 'dataModelUpdate':
        if (data.path && data.value) {
          setDeepValue(dataModel.value, data.path, data.value)
        }
        break
      case 'deleteSurface':
        components.value = []
        dataModel.value = {}
        break
    }
  }

  function setDeepValue(obj: Record<string, unknown>, path: string, value: unknown) {
    const parts = path.split('/').filter(Boolean)
    let current: Record<string, unknown> = obj
    for (let i = 0; i < parts.length - 1; i++) {
      // Fix the type issue here``
      if (!current[parts[i] as string]) current[parts[i] as string] = {}
      current = current[parts[i] as string] as Record<string, unknown>
    }
    current[parts[parts.length - 1] as string] = value
  }

  function sendAction(action: A2UIAction) {
    $fetch('/api/a2ui/action', {
      method: 'POST',
      body: action,
    }).catch(e => {
      error.value = e
    })
  }

  function disconnect() {
    eventSource?.close()
    eventSource = null
    isConnected.value = false
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    components: computed(() => components.value),
    dataModel: computed(() => dataModel.value),
    isConnected: computed(() => isConnected.value),
    error: computed(() => error.value),
    connect,
    disconnect,
    sendAction,
  }
}
