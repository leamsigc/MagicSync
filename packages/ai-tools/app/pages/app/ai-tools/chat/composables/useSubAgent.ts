import { ref, computed } from 'vue'

export interface SubAgentEvent {
  type: 'spawn' | 'step' | 'tool_call' | 'tool_result' | 'complete' | 'error'
  agentId: string
  task: string
  content?: string
  toolCall?: { tool: string; input: Record<string, any> }
  stepCount?: number
  maxSteps?: number
  done?: boolean
  error?: string
}

export interface SubAgentState {
  id: string
  task: string
  status: 'created' | 'running' | 'completed' | 'failed'
  taskType: string | null
  stepCount: number
  maxSteps: number
  steps: SubAgentStep[]
  result: string | null
  error: string | null
  isExpanded: boolean
}

export interface SubAgentStep {
  content: string
  toolCall?: { tool: string; input: Record<string, any>; result?: string }
  timestamp: Date
}

export function useSubAgent() {
  const agents = ref<Map<string, SubAgentState>>(new Map())
  const isDetecting = ref(false)

  async function detectSubAgent(message: string, context: any[] = []): Promise<{
    shouldSpawn: boolean
    taskType: string | null
    subAgentTask: string | null
    confidence: number
  }> {
    isDetecting.value = true
    try {
      const result = await $fetch<{
        should_spawn: boolean
        task_type: string | null
        sub_agent_task: string | null
        confidence: number
      }>('/api/ai-tools/agent/detect', {
        method: 'POST',
        body: { message, context },
      })
      return {
        shouldSpawn: result.should_spawn,
        taskType: result.task_type,
        subAgentTask: result.sub_agent_task,
        confidence: result.confidence,
      }
    } catch (e) {
      console.error('Sub-agent detection failed:', e)
      return { shouldSpawn: false, taskType: null, subAgentTask: null, confidence: 0 }
    } finally {
      isDetecting.value = false
    }
  }

  async function spawnSubAgent(
    task: string,
    parentMessageId: string,
    context?: any[],
    maxSteps = 10,
    taskType?: string,
  ): Promise<SubAgentState | null> {
    try {
      const result = await $fetch<{
        id: string
        task: string
        status: string
        parent_message_id: string
        max_steps: number
        step_count: number
      }>('/api/ai-tools/agent/spawn', {
        method: 'POST',
        body: {
          task,
          parent_message_id: parentMessageId,
          context,
          max_steps: maxSteps,
          task_type: taskType,
        },
      })

      const state: SubAgentState = {
        id: result.id,
        task: result.task,
        status: 'created',
        taskType: taskType || null,
        stepCount: 0,
        maxSteps: result.max_steps,
        steps: [],
        result: null,
        error: null,
        isExpanded: true,
      }

      agents.value.set(result.id, state)
      return state
    } catch (e) {
      console.error('Failed to spawn sub-agent:', e)
      return null
    }
  }

  async function executeStep(agentId: string): Promise<SubAgentEvent | null> {
    const agent = agents.value.get(agentId)
    if (!agent) return null

    try {
      const result = await $fetch<{
        content: string | null
        done: boolean
        tool_call: { tool: string; input: Record<string, any> } | null
        step_count: number
        error: string | null
      }>(`/api/ai-tools/agent/${agentId}/step`, {
        method: 'POST',
      })

      // Update local state
      agent.stepCount = result.step_count

      if (result.error) {
        agent.status = 'failed'
        agent.error = result.error
        return { type: 'error', agentId, task: agent.task, error: result.error }
      }

      if (result.done) {
        agent.status = 'completed'
        agent.result = result.content || ''
        return { type: 'complete', agentId, task: agent.task, content: result.content || '', done: true }
      }

      if (result.tool_call) {
        agent.steps.push({
          content: result.content || '',
          toolCall: { tool: result.tool_call.tool, input: result.tool_call.input },
          timestamp: new Date(),
        })
        agent.status = 'running'
        return {
          type: 'tool_call',
          agentId,
          task: agent.task,
          content: result.content || '',
          toolCall: result.tool_call,
          stepCount: result.step_count,
        }
      }

      // Regular step
      agent.steps.push({
        content: result.content || '',
        timestamp: new Date(),
      })
      agent.status = 'running'
      return {
        type: 'step',
        agentId,
        task: agent.task,
        content: result.content || '',
        stepCount: result.step_count,
      }
    } catch (e) {
      agent.status = 'failed'
      agent.error = (e as Error).message
      return { type: 'error', agentId, task: agent.task, error: (e as Error).message }
    }
  }

  async function streamAgent(agentId: string, onEvent: (event: SubAgentEvent) => void) {
    const agent = agents.value.get(agentId)
    if (!agent) return

    try {
      const response = await fetch(`/api/ai-tools/agent/${agentId}/stream`)
      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)
          if (json === '[DONE]') continue

          try {
            const data = JSON.parse(json)
            agent.stepCount = data.step_count || agent.stepCount

            if (data.done) {
              agent.status = 'completed'
              agent.result = data.content || data.result || ''
              onEvent({ type: 'complete', agentId, task: agent.task, content: agent.result ?? undefined, done: true })
            } else if (data.tool_call) {
              agent.steps.push({
                content: data.content || '',
                toolCall: data.tool_call,
                timestamp: new Date(),
              })
              agent.status = 'running'
              onEvent({
                type: 'tool_call',
                agentId,
                task: agent.task,
                toolCall: data.tool_call,
                stepCount: data.step_count,
              })
            } else if (data.error) {
              agent.status = 'failed'
              agent.error = data.error
              onEvent({ type: 'error', agentId, task: agent.task, error: data.error })
            } else if (data.content) {
              agent.steps.push({ content: data.content, timestamp: new Date() })
              agent.status = 'running'
              onEvent({
                type: 'step',
                agentId,
                task: agent.task,
                content: data.content,
                stepCount: data.step_count,
              })
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (e) {
      agent.status = 'failed'
      agent.error = (e as Error).message
      onEvent({ type: 'error', agentId, task: agent.task, error: (e as Error).message })
    }
  }

  async function addToolResult(agentId: string, toolName: string, result: string) {
    try {
      await $fetch(`/api/ai-tools/agent/${agentId}/message`, {
        method: 'POST',
        body: { role: 'tool', content: result, tool_name: toolName },
      })

      const agent = agents.value.get(agentId)
      if (agent && agent.steps.length > 0) {
        const lastStep = agent.steps[agent.steps.length - 1]
        if (lastStep && lastStep.toolCall && lastStep.toolCall.tool === toolName) {
          lastStep.toolCall.result = result
        }
      }
    } catch (e) {
      console.error('Failed to add tool result:', e)
    }
  }

  function toggleExpand(agentId: string) {
    const agent = agents.value.get(agentId)
    if (agent) {
      agent.isExpanded = !agent.isExpanded
    }
  }

  function getAgent(agentId: string): SubAgentState | undefined {
    return agents.value.get(agentId)
  }

  function clearAgents() {
    agents.value.clear()
  }

  return {
    agents: computed(() => agents.value),
    isDetecting: computed(() => isDetecting.value),
    detectSubAgent,
    spawnSubAgent,
    executeStep,
    streamAgent,
    addToolResult,
    toggleExpand,
    getAgent,
    clearAgents,
  }
}
