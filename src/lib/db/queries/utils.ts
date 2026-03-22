import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/infra/supabase/database.types'
import { ok, err } from '@/lib/core/result'
import type { Result } from '@/lib/core/result'

export type { Result }
export type Supabase = SupabaseClient<Database>

const isProd = import.meta.env.PROD

// ── Error helpers ─────────────────────────────────────────────────────────────
export function normalizeError(e: unknown): Error {
  if (e instanceof Error) return e
  if (typeof e === 'string') return new Error(e)
  return new Error('Unknown error')
}

export function logError(
  context: string,
  e: unknown,
  meta: Record<string, unknown> = {}
) {
  const stack = e instanceof Error
    ? e.stack?.split('\n').slice(0, isProd ? 3 : 8).join('\n')
    : null
  console.error(JSON.stringify({
    ts:  new Date().toISOString(),
    ctx: context,
    err: e instanceof Error
      ? { name: e.name, msg: e.message, ...(isProd ? {} : { stack }) }
      : String(e),
    ...meta,
  }))
}

// ── Result wrappers (retournent ok/err de core/result.ts) ─────────────────────
export function handleSingle<T>(
  { data, error }: { data: T | null; error: PostgrestError | null },
  notFoundMsg = 'Resource not found'
): Result<T, Error> {
  if (error) return err(Object.assign(new Error(error.message), { pgError: error }))
  if (!data)  return err(new Error(notFoundMsg))
  return ok(data)
}

export function handleArray<T>(
  { data, error }: { data: T[] | null; error: PostgrestError | null }
): Result<T[], Error> {
  if (error) return err(Object.assign(new Error(error.message), { pgError: error }))
  return ok(data ?? [])
}

// ── Validation ────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export const MAX_STATS_DAYS     = 90
export const DEFAULT_STATS_DAYS = 7

export function getCurrentIso(): string {
  return new Date().toISOString()
}

export function getStartDate(days: number): string {
  const safe = Math.min(Math.max(1, days), MAX_STATS_DAYS)
  const d = new Date()
  d.setDate(d.getDate() - safe)
  return d.toISOString().split('T')[0]
}

// ── DB Payload helper ─────────────────────────────────────────────────────────
type RemoveUndefined<T> = {
  [K in keyof T]-?: Exclude<T[K], undefined>
}

export function dbPayload<T extends object>(obj: T): RemoveUndefined<T> {
  return JSON.parse(JSON.stringify(obj)) as RemoveUndefined<T>
}

// ── Json cast helper ──────────────────────────────────────────────────────────
export function toJson(value: unknown): Json {
  return value as Json
}