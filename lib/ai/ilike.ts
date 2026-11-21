// Escaping for PostgREST `ilike` patterns (QA audit M12 / S11).
//
// A raw user string interpolated into `%${value}%` lets `%` and
// `_` act as wildcards (and `\` as an escape), so a search for
// "%" matches every row. Escape the three LIKE metacharacters
// first; Postgres LIKE treats backslash as its default escape,
// so `\%`, `\_` and `\\` match literally.
//
// `.or()` filters are comma-separated, and a comma inside the
// value would split the filter apart — so the or-string helper
// also drops commas (replaced with a space) before building the
// pattern. That only narrows the match text, never widens it.

export function escapeIlikePattern(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

export function ilikeContains(value: string): string {
  return `%${escapeIlikePattern(value)}%`
}

/** One `column.ilike.%value%` clause for a `.or()` filter string. */
export function orIlike(column: string, value: string): string {
  return `${column}.ilike.%${escapeIlikePattern(value.replace(/,/g, ' '))}%`
}
