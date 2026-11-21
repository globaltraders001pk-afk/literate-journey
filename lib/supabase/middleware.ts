import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Only /login is public (QA audit L3): no register page and no
  // /auth/callback exist in this repo, so /register and /auth*
  // must not be public routes — anyone hitting them is sent to
  // /login like any other protected path. Account creation is
  // owner/admin-only via createEmployee.
  const isAuthRoute = pathname.startsWith('/login')

  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  // Fast path 1: Unauthenticated request to public auth route (no auth cookie) -> 0ms pass-through
  if (!hasAuthCookie && isAuthRoute) {
    return NextResponse.next({ request })
  }

  // Fast path 2: Unauthenticated request to protected route (no auth cookie) -> 0ms instant redirect
  if (!hasAuthCookie && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // NOTE (QA audit H11): there used to be a third fast path here —
  // prefetch requests carrying an auth cookie skipped getUser()
  // entirely. A cookie NAME proves nothing (cookies can be stale,
  // forged, or logged-out server-side), so it is gone: every
  // request that reaches this point, prefetch included, is
  // validated with getUser() below.

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fail CLOSED when the Supabase env is missing: the old code
  // logged and passed the request through, which let protected
  // pages render with no auth backend behind them. Protected
  // routes redirect to /login; auth routes get a plain 500
  // (redirecting /login to /login would loop).
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (isAuthRoute) {
      return new NextResponse('Server configuration error: Supabase is not configured.', { status: 500 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to dashboard if logged in and trying to access auth pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
