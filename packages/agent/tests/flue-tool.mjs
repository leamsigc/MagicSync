/**
 * T28 — invoke a Flue tool from a test.
 *
 * A Flue tool's `run` takes a `ToolContext` (`toolCallId`, `signal`, `log`,
 * plus `data` parsed from the valibot `input` schema) and returns the canonical
 * `{ output }` envelope, so the pi `execute(toolCallId, params, …)` +
 * `JSON.parse(result.content[0].text)` pair is gone. `runTool` returns the
 * `output` value directly; `runToolEnvelope` returns the whole envelope.
 */

const noopLogger = { info: () => {}, warn: () => {}, error: () => {} }

/** Run a Flue tool and return its `output` value. */
export async function runTool(tool, data = {}, { toolCallId = 'test-call' } = {}) {
  const result = await runToolEnvelope(tool, data, { toolCallId })
  return result?.output
}

/** Run a Flue tool and return the whole `{ output, terminate }` envelope. */
export async function runToolEnvelope(tool, data = {}, { toolCallId = 'test-call' } = {}) {
  return tool.run({ toolCallId, data, log: noopLogger })
}

/** Find one tool by name in a bag array or a name-keyed bag. */
export function findTool(tools, name) {
  const list = Array.isArray(tools) ? tools : Object.values(tools ?? {})
  const tool = list.find(entry => entry.name === name)
  if (!tool) throw new Error(`tool ${name} does not exist`)
  return tool
}
