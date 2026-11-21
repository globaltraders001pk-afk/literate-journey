/**
 * Auto-generated batch codes for batches the system creates itself
 * (purchase receiving, opening stock). Format: `AUTO-20261121-AB12CD`
 * — the date the stock entered plus a random suffix, so two receipts
 * of the same product on the same day never collide.
 */
export function generateAutoBatchNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `AUTO-${date}-${suffix}`
}
