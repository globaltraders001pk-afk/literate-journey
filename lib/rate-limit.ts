// In-memory fixed-window rate limiter (QA audit M12/M17).
//
// No new infra: one process-wide Map of counters, keyed by
// caller (user id, email, IP, ...). Each key gets `limit`
// attempts per `windowMs`; further attempts are rejected until
// the window resets. This is per-instance state, so a
// multi-instance deploy would need a shared store — for this
// single-instance app it is the honest, narrow fix.
interface WindowEntry {
  count: number
  resetAt: number
}

const windows = new Map<string, WindowEntry>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const entry = windows.get(key)
  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }
  if (entry.count < limit) {
    entry.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  }
}

/** Peek without counting: is this key already over its limit? */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { limited: boolean; retryAfterSeconds: number } {
  const entry = windows.get(key)
  if (!entry || now >= entry.resetAt) return { limited: false, retryAfterSeconds: 0 }
  if (entry.count < limit) return { limited: false, retryAfterSeconds: 0 }
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  }
}

/** Test/support hook: drop one key's counter (e.g. after a successful login). */
export function resetRateLimit(key: string): void {
  windows.delete(key)
}
