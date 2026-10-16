import { and, asc, desc, eq, getTableColumns, like, or, sql, type Column, type SQL } from 'drizzle-orm'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import {
  adminTableRegistry,
  buildAdminColumns,
  decodeRowKey,
  encodeRowKey,
  getAdminTable,
  getPrimaryKeyFields,
  type AdminColumnMeta,
  type AdminTableConfig,
  type AdminTableSummary,
} from '#layers/BaseDB/server/utils/admin-tables'
import type { ServiceResponse } from './types'
import type { AdminDataServiceType } from './interfaces'

export type AdminRow = Record<string, unknown>

export const ADMIN_ROW_KEY_FIELD = '_key'

function withRowKey(config: AdminTableConfig, row: AdminRow): AdminRow {
  return { ...row, [ADMIN_ROW_KEY_FIELD]: encodeRowKey(config, row) }
}

export interface AdminRowPage {
  table: { key: string; label: string; group: string }
  columns: AdminColumnMeta[]
  rows: AdminRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface AdminRowQuery {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  filters?: Record<string, string>
}

type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string }

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

function coerceNumber(value: unknown): CoerceResult {
  const num = Number(value)
  return Number.isFinite(num)
    ? { ok: true, value: num }
    : { ok: false, error: 'not a number' }
}

function coerceDatetime(value: unknown): CoerceResult {
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? { ok: false, error: 'invalid date' }
    : { ok: true, value: date }
}

function coerceJson(value: unknown): CoerceResult {
  if (typeof value !== 'string') return { ok: true, value }
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return { ok: false, error: 'invalid JSON' }
  }
}

const VALUE_COERCERS: Record<AdminColumnMeta['type'], (value: unknown) => CoerceResult> = {
  number: coerceNumber,
  datetime: coerceDatetime,
  json: coerceJson,
  boolean: value => ({ ok: true, value: Boolean(value) }),
  enum: value => ({ ok: true, value: String(value) }),
  text: value => ({ ok: true, value: String(value) }),
  textarea: value => ({ ok: true, value: String(value) }),
}

function coerceValue(meta: AdminColumnMeta, value: unknown): CoerceResult {
  if (value === null && meta.notNull) {
    return { ok: false, error: 'value is required' }
  }
  if (value === null) {
    return { ok: true, value: null }
  }
  return VALUE_COERCERS[meta.type](value)
}

function coercePrimaryKeyValue(column: Column, raw: string): string | number {
  return column.dataType === 'number' ? Number(raw) : raw
}

function buildRowKeyCondition(
  config: AdminTableConfig,
  columns: Record<string, Column>,
  rowKeys: string[],
): SQL {
  const pkFields = getPrimaryKeyFields(config)
  const perRow = rowKeys.map(rowKey => {
    const values = decodeRowKey(config, rowKey)
    const comparisons = pkFields.map((field, index) =>
      eq(columns[field], coercePrimaryKeyValue(columns[field], values[index] ?? '')),
    )
    return and(...comparisons)
  })
  return or(...perRow) ?? sql`1 = 0`
}

function buildSearchCondition(
  columns: Record<string, Column>,
  meta: AdminColumnMeta[],
  search: string,
): SQL | undefined {
  const targets = meta.filter(item => item.type === 'text' || item.type === 'textarea' || item.type === 'enum')
  if (targets.length === 0) return undefined
  const matches = targets.map(item => like(columns[item.key], `%${search}%`))
  return or(...matches)
}

function buildSingleFilter(
  column: Column | undefined,
  item: AdminColumnMeta | undefined,
  value: string,
): SQL | undefined {
  if (!column || !item) return undefined
  if (value === '') return undefined
  if (item.type === 'number') {
    const num = Number(value)
    return Number.isFinite(num) ? eq(column, num) : undefined
  }
  return eq(column, value)
}

function buildFilterCondition(
  columns: Record<string, Column>,
  meta: AdminColumnMeta[],
  filters: Record<string, string> | undefined,
): SQL | undefined {
  if (!filters) return undefined
  const conditions = Object.entries(filters)
    .map(([key, value]) => buildSingleFilter(columns[key], meta.find(item => item.key === key), value))
    .filter((condition): condition is SQL => condition !== undefined)
  return combineConditions(conditions)
}

function combineConditions(conditions: Array<SQL | undefined>): SQL | undefined {
  const present = conditions.filter((condition): condition is SQL => condition !== undefined)
  if (present.length === 0) return undefined
  return and(...present)
}

function defaultSortKey(meta: AdminColumnMeta[]): string {
  if (meta.some(item => item.key === 'createdAt')) return 'createdAt'
  return meta.find(item => item.pk)?.key ?? 'id'
}

function buildOrderBy(
  columns: Record<string, Column>,
  meta: AdminColumnMeta[],
  query: AdminRowQuery,
): SQL {
  const requested = query.sort && meta.some(item => item.key === query.sort) ? query.sort : defaultSortKey(meta)
  const column = columns[requested] ?? columns[defaultSortKey(meta)]
  return query.direction === 'asc' ? asc(column) : desc(column)
}

function normalizePositive(value: number | undefined, fallback: number): number {
  return value === undefined || value < 1 ? fallback : Math.floor(value)
}

export class AdminDataService implements AdminDataServiceType {
  private db = useDrizzle()

  async listTables(): Promise<ServiceResponse<AdminTableSummary[]>> {
    try {
      const summaries = await Promise.all(adminTableRegistry.map(config => this.summarizeTable(config)))
      return { success: true, data: summaries }
    } catch (error) {
      log.error({ message: 'admin data: failed to list tables', error: String(error) })
      return { success: false, error: 'Failed to load table catalog', code: 'DB_ERROR' }
    }
  }

  async listRows(key: string, query: AdminRowQuery = {}): Promise<ServiceResponse<AdminRowPage>> {
    const config = getAdminTable(key)
    if (!config) {
      return { success: false, error: `Unknown table: ${key}`, code: 'NOT_FOUND' }
    }

    try {
      const columns = getTableColumns(config.table)
      const meta = buildAdminColumns(config)
      const search = query.search?.trim()
      const searchCondition = search ? buildSearchCondition(columns, meta, search) : undefined
      const filterCondition = buildFilterCondition(columns, meta, query.filters)
      const where = combineConditions([searchCondition, filterCondition])

      const page = normalizePositive(query.page, 1)
      const limit = Math.min(normalizePositive(query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)

      const [countRow] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(config.table)
        .where(where)
        .all()
      const total = countRow?.count ?? 0

      const visibleColumns = Object.fromEntries(meta.map(item => [item.key, columns[item.key]]))
      const rows = await this.db
        .select(visibleColumns)
        .from(config.table)
        .where(where)
        .orderBy(buildOrderBy(columns, meta, query))
        .limit(limit)
        .offset((page - 1) * limit)
        .all()

      return {
        success: true,
        data: {
          table: { key: config.key, label: config.label, group: config.group },
          columns: meta,
          rows: (rows as AdminRow[]).map(row => withRowKey(config, row)),
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        },
      }
    } catch (error) {
      log.error({ message: 'admin data: failed to list rows', table: key, error: String(error) })
      return { success: false, error: `Failed to load rows from ${key}`, code: 'DB_ERROR' }
    }
  }

  async updateRow(key: string, rowKey: string, values: AdminRow): Promise<ServiceResponse<AdminRow>> {
    const config = getAdminTable(key)
    if (!config) {
      return { success: false, error: `Unknown table: ${key}`, code: 'NOT_FOUND' }
    }

    const meta = buildAdminColumns(config)
    const columns = getTableColumns(config.table)
    const prepared = this.prepareUpdate(meta, values)
    if (!prepared.ok) {
      return { success: false, error: prepared.error, code: 'VALIDATION_ERROR' }
    }

    try {
      const condition = buildRowKeyCondition(config, columns, [rowKey])
      await this.db.update(config.table).set(prepared.value).where(condition)
      const visibleColumns = Object.fromEntries(meta.map(item => [item.key, columns[item.key]]))
      const [updated] = await this.db.select(visibleColumns).from(config.table).where(condition).all()
      if (!updated) {
        return { success: false, error: 'Row not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: withRowKey(config, updated as AdminRow) }
    } catch (error) {
      log.error({ message: 'admin data: failed to update row', table: key, error: String(error) })
      return { success: false, error: `Failed to update row in ${key}`, code: 'DB_ERROR' }
    }
  }

  async deleteRows(key: string, rowKeys: string[]): Promise<ServiceResponse<{ deleted: number }>> {
    const config = getAdminTable(key)
    if (!config) {
      return { success: false, error: `Unknown table: ${key}`, code: 'NOT_FOUND' }
    }
    if (rowKeys.length === 0) {
      return { success: false, error: 'No rows selected', code: 'VALIDATION_ERROR' }
    }

    try {
      const columns = getTableColumns(config.table)
      const result = await this.db.delete(config.table).where(buildRowKeyCondition(config, columns, rowKeys))
      return { success: true, data: { deleted: Number(result.rowsAffected ?? 0) } }
    } catch (error) {
      log.error({ message: 'admin data: failed to delete rows', table: key, error: String(error) })
      return { success: false, error: `Failed to delete rows from ${key}`, code: 'DB_ERROR' }
    }
  }

  private async summarizeTable(config: AdminTableConfig): Promise<AdminTableSummary> {
    const base = { key: config.key, label: config.label, group: config.group }
    try {
      const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(config.table).all()
      return { ...base, rowCount: row?.count ?? 0 }
    } catch {
      return { ...base, rowCount: null }
    }
  }

  private prepareUpdate(
    meta: AdminColumnMeta[],
    values: AdminRow,
  ): { ok: true; value: AdminRow } | { ok: false; error: string } {
    const entries = Object.entries(values)
    if (entries.length === 0) {
      return { ok: false, error: 'Nothing to update' }
    }

    const prepared: AdminRow = {}
    for (const [columnKey, rawValue] of entries) {
      const columnMeta = meta.find(item => item.key === columnKey)
      if (!columnMeta?.editable) {
        return { ok: false, error: `Field not editable: ${columnKey}` }
      }
      const coerced = coerceValue(columnMeta, rawValue)
      if (!coerced.ok) {
        return { ok: false, error: `Invalid value for ${columnKey}: ${coerced.error}` }
      }
      prepared[columnKey] = coerced.value
    }
    return { ok: true, value: prepared }
  }
}

export const adminDataService = new AdminDataService()
