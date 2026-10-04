/**
 * T20 capability aggregator — the single import for every adapter (HTTP
 * route, MCP tool, job, pipeline node). Importing this module registers every
 * declared capability exactly once; adapters then call `runCapability` and
 * contain no prompt, no skill selection, and no model call.
 */
import './goal'
import './text'
import './social'
import './sql'
import './playbook'
import './workflow'
import './delivery'
import './content'

export { runCapability, capabilityRegistry, type Capability, type CapabilityRunContext, type CapabilityOutcome } from './registry'
export { buildCapabilityRunContext } from './run-context'
