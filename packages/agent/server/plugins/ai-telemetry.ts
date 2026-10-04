import { ensureAiCallTelemetry } from '../agent/telemetry'

/**
 * Agent-layer boot (PRD T19): install the Flue `ai.call` telemetry exactly
 * once per process. `ensureAiCallTelemetry` is idempotent and HMR-safe
 * (globalThis guard); installing before any runtime starts is supported —
 * the subscriber stays idle until the first Flue turn.
 */
export default defineNitroPlugin(() => {
  void ensureAiCallTelemetry()
})
