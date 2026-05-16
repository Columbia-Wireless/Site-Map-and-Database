import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session — do not remove this
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicPath = pathname.startsWith('/login') || pathname.startsWith('/auth')

  // Resolve the public-facing base URL for redirects.
  //
  // Priority order:
  //   1. SITE_URL env var — set this on Cloud Run, eliminates all ambiguity
  //   2. x-forwarded-host header — Cloud Run standard forwarding
  //   3. host header — but only if it isn't the internal container address
  //   4. request.nextUrl.origin — last resort (will be http://0.0.0.0:8080 in Cloud Run)
  const SITE_URL = process.env.SITE_URL
  const fwdHost  = request.headers.get('x-forwarded-host') || ''
  const hostHdr  = request.headers.get('host') || ''
  const fwdProto = request.headers.get('x-forwarded-proto') || 'https'

  const resolvedHost =
    fwdHost && !fwdHost.startsWith('0.0.0.0') ? fwdHost :
    hostHdr && !hostHdr.startsWith('0.0.0.0') ? hostHdr :
    null

  const baseUrl =
    SITE_URL ||
    (resolvedHost ? `${fwdProto}://${resolvedHost}` : null) ||
    request.nextUrl.origin

  // Not logged in → redirect to login
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', baseUrl))
  }

  // Already logged in → skip login page
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', baseUrl))
  }

  // MFA enforcement: if user has TOTP enrolled but hasn't completed AAL2 this session,
  // redirect to the MFA challenge page (except when already on /auth/mfa or /settings)
  if (user && !isPublicPath && pathname !== '/auth/mfa' && pathname !== '/settings') {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/auth/mfa', baseUrl))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip static files, images, and API routes
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
