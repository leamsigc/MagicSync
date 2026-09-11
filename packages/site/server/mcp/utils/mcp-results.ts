/**
 * MCP-side re-export of the shared ServiceResponse unwrapper.
 * Canonical home is the tools layer so db/tools/server code can use it too
 * (layers only see downwards: site → tools, never the reverse).
 */
export { orThrow } from '#layers/BaseTools/server/utils/service-result'
