/**
 * Backwards-compatible re-export: AI-call telemetry lives at the canonical
 * agent-layer location (`server/agent/telemetry.ts`, PRD T19). Capability
 * code and tests keep importing from here.
 */
export * from '../agent/telemetry'
