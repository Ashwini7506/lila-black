'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/utils/supabase'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('Auth callback error:', error.message)
          router.replace('/?error=auth_failed')
        } else {
          router.replace('/dashboard')
        }
      })
    } else {
      // Implicit flow — session is set from the URL hash automatically
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) router.replace('/dashboard')
        else router.replace('/')
      })
    }
  }, [router, searchParams])

  return null
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="font-bold text-sm tracking-widest uppercase text-white">LILA BLACK</span>
      </div>
      <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-gray-600 text-xs tracking-widest uppercase">Signing you in…</p>
      <Suspense>
        <AuthCallbackInner />
      </Suspense>
    </div>
  )
}
