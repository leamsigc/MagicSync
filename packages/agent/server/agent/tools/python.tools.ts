import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { listPythonTools, runPythonTool } from '../../utils/python-tools'
import type { AgentToolContext } from '../tool-context'

function toolResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }], details: {} }
}

function toolError(code: string | undefined, message: string): never {
  throw new Error(`${code ?? 'PYTHON_TOOLS_ERROR'}: ${message}`)
}

export function createPythonTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'python_tools_list',
      label: 'List Python tools',
      description: 'List the tools exposed by the configured Python tools backend.',
      parameters: Type.Object({}),
      execute: async () => {
        const result = await listPythonTools(ctx.userId)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ tools: result.success ? result.data.tools : [] })
      },
    }),
    defineTool({
      name: 'python_tool_run',
      label: 'Run a Python tool',
      description: 'Run one tool on the configured Python tools backend (e.g. scrapegraph_smartscraper).',
      parameters: Type.Object({
        tool: Type.String({ description: 'Tool name from python_tools_list' }),
        args: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: 'Tool arguments' })),
      }),
      execute: async (_toolCallId, params) => {
        const result = await runPythonTool(ctx.userId, params.tool, params.args ?? {})
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : { tool: params.tool, result: null })
      },
    }),
  ]
}
