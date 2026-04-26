import { useEventListener } from '@vueuse/core'
import { onMounted, ref } from 'vue'

export interface AudioDevice {
  deviceId: string
  label: string
  groupId: string
}

export function useAudioDevices() {
  const devices = ref<AudioDevice[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const hasPermission = ref(false)
  const selectedDeviceId = ref<string>('')

  const processDevices = (deviceList: MediaDeviceInfo[]) => {
    return deviceList
      .filter(device => device.kind === 'audioinput')
      .map((device) => {
        let cleanLabel = device.label || `Microphone ${device.deviceId.slice(0, 8)}`
        cleanLabel = cleanLabel.replace(/\s*\([^)]*\)/g, '').trim()
        return {
          deviceId: device.deviceId,
          label: cleanLabel,
          groupId: device.groupId,
        }
      })
  }

  const loadDevices = async (withPermission = false) => {
    try {
      loading.value = true
      error.value = null

      if (withPermission) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach(track => track.stop())
        hasPermission.value = true
      }

      const deviceList = await navigator.mediaDevices.enumerateDevices()
      devices.value = processDevices(deviceList)

      if (!selectedDeviceId.value && devices.value.length > 0) {
        selectedDeviceId.value = devices.value[0].deviceId
      }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get audio devices'
    }
    finally {
      loading.value = false
    }
  }

  const requestPermission = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: selectedDeviceId.value ? { deviceId: { exact: selectedDeviceId.value } } : true 
      })
      hasPermission.value = true
      await loadDevices(false)
      return stream
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Microphone permission denied'
      return null
    }
  }

  const selectDevice = (deviceId: string) => {
    selectedDeviceId.value = deviceId
  }

  onMounted(() => loadDevices(false))

  if (typeof window !== 'undefined' && navigator.mediaDevices) {
    useEventListener(navigator.mediaDevices, 'devicechange', () => {
      loadDevices(hasPermission.value)
    })
  }

  return {
    devices,
    loading,
    error,
    hasPermission,
    selectedDeviceId,
    selectDevice,
    requestPermission,
    loadDevices: () => loadDevices(false),
    requestPermissionAndLoad: () => loadDevices(true),
  }
}