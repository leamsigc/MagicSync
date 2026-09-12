// Test stub for #layers/BaseDB/server/utils/drizzle. Returns the file-backed
// drizzle client installed by setup.mjs instead of connecting to Turso.
export function useDrizzle() {
  if (!globalThis.__TEST_DB) throw new Error('test DB not initialized — call initTestDb() first')
  return globalThis.__TEST_DB
}

export const tables = {}
