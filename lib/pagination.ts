// Server-side paging for list reads (QA audit M11, Phase 2).
//
// The repo's list actions used to fetch every row with no limit:
// cost and payload grew with total history, and PostgREST's own
// max-rows cap could silently truncate counts. Every paged
// getter now takes PageOptions, applies a server-side limit,
// and returns the total count alongside the rows so the UI can
// disclose truncation ("showing first N of M") instead of
// silently cutting the list off.
export const DEFAULT_LIST_LIMIT = 500
export const MAX_LIST_LIMIT = 1000

export interface PageOptions {
  limit?: number
  offset?: number
}

export interface PagedResult<T> {
  rows: T[]
  total: number
  limit: number
  offset: number
}

export function normalizePageOptions(options?: PageOptions): {
  limit: number
  offset: number
} {
  const rawLimit = options?.limit
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(rawLimit as number)))
    : DEFAULT_LIST_LIMIT
  const rawOffset = options?.offset
  const offset = Number.isFinite(rawOffset)
    ? Math.max(0, Math.floor(rawOffset as number))
    : 0
  return { limit, offset }
}

/**
 * Disclosure line for a truncated list, or null when the whole
 * list is shown. Pages render this under the table so a cap is
 * never silent.
 */
export function truncationNote(
  total: number,
  shown: number,
  label: string
): string | null {
  if (total <= shown) return null
  return `Showing first ${shown} of ${total} ${label} — use search or filters to narrow the list.`
}
