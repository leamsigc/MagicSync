import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { toolBackendsService } from '#layers/BaseDB/server/services/tool-backends.service'

export interface PythonBackendConfig {
  url: string
  token: string | null
}

/** Resolve the user-configured Python tools backend (settings first, env fallback). */
export async function resolvePythonBackend(userId: string): Promise<ServiceResponse<PythonBackendConfig>> {
  const settings = await toolBackendsService.get(userId)
  const url = (settings.data?.pythonBackendUrl ?? process.env.PYTHON_TOOLS_URL ?? '').trim()
  if (!url) {
    return {
      success: false,
      error: 'Python tools backend is not configured. Add its URL in AI settings.',
      code: 'PYTHON_BACKEND_NOT_CONFIGURED',
    }
  }
  return {
    success: true,
    data: {
      url: url.replace(/\/+$/, ''),
      token: settings.data?.pythonBackendToken ?? process.env.PYTHON_TOOLS_TOKEN ?? null,
    },
  }
}

export async function callPythonBackend<T>(
  config: PythonBackendConfig,
  path: string,
  init: RequestInit = {},
): Promise<ServiceResponse<T>> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (config.token) headers.authorization = `Bearer ${config.token}`
  if (init.body) headers['content-type'] = 'application/json'

  try {
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return {
        success: false,
        error: `Python backend responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        code: 'PYTHON_BACKEND_FAILED',
      }
    }
    return { success: true, data: await response.json() as T }
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Python backend unreachable',
      code: 'PYTHON_BACKEND_UNREACHABLE',
    }
  }
}

export async function listPythonTools(userId: string): Promise<ServiceResponse<{ tools: unknown[] }>> {
  const config = await resolvePythonBackend(userId)
  if (!config.success) return config
  return callPythonBackend<{ tools: unknown[] }>(config.data, '/tools', { method: 'GET' })
}

export async function runPythonTool(
  userId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<ServiceResponse<Record<string, unknown>>> {
  const config = await resolvePythonBackend(userId)
  if (!config.success) return config
  return callPythonBackend<Record<string, unknown>>(config.data, `/tools/${encodeURIComponent(tool)}/run`, {
    method: 'POST',
    body: JSON.stringify({ args }),
  })
}
