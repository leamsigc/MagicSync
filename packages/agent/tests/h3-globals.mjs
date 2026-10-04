import { createError, defineEventHandler, getQuery, sendStream, setResponseHeaders } from 'h3'

/**
 * Installs the Nuxt auto-imports that route handlers rely on, so a route module
 * can be imported in plain Node. Imported before any route module so the
 * module-level `defineEventHandler(...)` call resolves.
 */
Object.assign(globalThis, {
  defineEventHandler,
  createError,
  getQuery,
  setResponseHeaders,
  sendStream,
  useLogger: () => ({ set() {}, info() {}, warn() {}, error() {}, debug() {} }),
})
