import { $fetch } from 'ofetch';
/**
 *
 * Component Description: Composable managing higher-level actions like AI health checks and publishing
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import type { HookHealthResult, HookVariation } from './useContentPipeline'

export const useContentPipelineManagement = () => {
  const isCheckingHealth = ref(false)
  const isSaving = ref(false)
  const isPublishing = ref(false)

  const checkHookHealth = async (topic: string, selectedHook: HookVariation, hooks: HookVariation[], scriptContent: string) => {
    if (!topic || !scriptContent) return null
    isCheckingHealth.value = true
    try {
      const result: HookHealthResult = await $fetch("/api/v1/ai/hook-health", {
        method: "POST",
        body: {
          topic,
          hookName: selectedHook.name,
          hooks,
          script: scriptContent
        }
      })
      return result
    } finally {
      isCheckingHealth.value = false
    }
  }

  const saveDraft = async (data: any) => {
    isSaving.value = true
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      log.debug({ message: 'Saved draft', detail: data })
    } finally {
      isSaving.value = false
    }
  }

  const markAsPublished = async (url: string) => {
    if (!url) return
    isPublishing.value = true
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      log.info({ message: 'Published', detail: url })
    } finally {
      isPublishing.value = false
    }
  }

  return {
    isCheckingHealth,
    isSaving,
    isPublishing,
    checkHookHealth,
    saveDraft,
    markAsPublished,
  }
}
