import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logChange } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vfntpdpneusqgcwxwkix.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnRwZHBuZXVzcWdjd3h3a2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NTg2MzEsImV4cCI6MjA5MzUzNDYzMX0.kFZ6b2WKAl7GVsEQZeO33qcxhyBruQlTfW0eZfkcg1c'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const ip =
      headerStore.get('x-forwarded-for')?.split(',')[0].trim() ||
      headerStore.get('x-real-ip') ||
      'unknown'

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Log the OAuth login (Google or Microsoft)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const provider = session.user.app_metadata?.provider ?? 'oauth'
        await logChange(supabase, null, 'user_login', null, session.user.email ?? null, session.user.email ?? 'User', {
          userId: session.user.id,
          ip,
          entityType: 'auth',
        })
        // Suppress unused var warning — provider used in field_name below
        void provider
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
