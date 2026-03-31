import { ref, computed, onUnmounted } from 'vue'

interface A2UIComponent {
  id: string
  component: Record<string, any>
}

interface A2UIAction {
  action: string
  surfaceId: string
  componentId: string
  payload?: Record<string, any>
}

export function useA2UI() {
  const components = ref<A2UIComponent[]>([])
  const dataModel = ref<Record<string, any>>({})
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

  function handleMessage(data: any) {
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

  function setDeepValue(obj: any, path: string, value: any) {
    const parts = path.split('/').filter(Boolean)
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {}
      current = current[parts[i]]
    }
    current[parts[parts.length - 1]] = value
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
