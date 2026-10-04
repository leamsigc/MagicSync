import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { listPythonTools, runPythonTool } from '../../utils/python-tools'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'PYTHON_TOOLS_ERROR')

export function createPythonTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'python_tools_list',
      description: 'List the tools exposed by the configured Python tools backend.',
      input: v.object({}),
      run: async () => {
        const result = await listPythonTools(ctx.userId)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ tools: result.success ? result.data.tools : [] })
      },
    }),
    defineTool({
      name: 'python_tool_run',
      description: 'Run one tool on the configured Python tools backend (e.g. scrapegraph_smartscraper).',
      input: v.object({
        tool: v.pipe(v.string(), v.description('Tool name from python_tools_list')),
        args: v.optional(v.record(v.string(), v.unknown())),
      }),
      run: async (toolCtx) => {
        const { tool, args } = toolCtx.data
        const result = await runPythonTool(ctx.userId, tool, args ?? {})
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : { tool, result: null })
      },
    }),
  ]
}
