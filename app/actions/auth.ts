'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { checkRateLimit, isRateLimited, resetRateLimit } from '@/lib/rate-limit'

// Login abuse guards (QA audit M17): 5 failed attempts per email
// AND per IP, then a 15-minute lockout. Only failures count —
// a successful login clears both counters, so normal use never
// locks anyone out.
const MAX_FAILED_LOGINS = 5
const LOGIN_LOCKOUT_MS = 15 * 60_000

export async function login(
  prevState: { error: string } | undefined,
  formData: FormData
) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const headerList = await headers()
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Both keys must be clear: per-email stops password spraying on
  // one account, per-IP stops spraying across accounts from one
  // source. Peek only — this check must not count the attempt.
  const emailBlock = isRateLimited(
    `login:email:${email}`,
    MAX_FAILED_LOGINS,
    LOGIN_LOCKOUT_MS
  )
  const ipBlock = isRateLimited(
    `login:ip:${ip}`,
    MAX_FAILED_LOGINS,
    LOGIN_LOCKOUT_MS
  )
  if (emailBlock.limited || ipBlock.limited) {
    const retryAfter = Math.max(
      emailBlock.retryAfterSeconds,
      ipBlock.retryAfterSeconds
    )
    return {
      error: `Too many failed login attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Generic message (QA audit M17): Supabase's raw message
    // leaks whether the email exists ("Invalid login
    // credentials" vs "Email not confirmed", etc.).
    checkRateLimit(`login:email:${email}`, MAX_FAILED_LOGINS, LOGIN_LOCKOUT_MS)
    checkRateLimit(`login:ip:${ip}`, MAX_FAILED_LOGINS, LOGIN_LOCKOUT_MS)
    return { error: 'Invalid email or password.' }
  }

  // Success clears the failure counters.
  resetRateLimit(`login:email:${email}`)
  resetRateLimit(`login:ip:${ip}`)

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
