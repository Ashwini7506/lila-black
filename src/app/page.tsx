'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

export default function Landing() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // If already signed in, skip to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
  }, [router])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-900">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-bold text-sm tracking-widest uppercase text-white">LILA BLACK</span>
        </div>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
        >
          {loading ? 'Redirecting…' : 'Sign in'}
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Glow backdrop */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/50 text-blue-300 text-[11px] font-medium tracking-widest uppercase px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Level Design Visualizer
          </div>

          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-5">
            Understand how players<br />
            <span className="text-blue-400">move through your levels.</span>
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
            Replay matches, visualise player paths, analyse kill zones, and uncover design patterns — all from raw telemetry data.
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="inline-flex items-center gap-3 bg-white text-gray-900 font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-gray-100 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <p className="text-gray-700 text-xs mt-4">
            Internal tool — authorised team members only
          </p>
        </div>
      </main>

      {/* Feature strip */}
      <section className="border-t border-gray-900 px-8 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: '◎',
              title: 'Path Replay',
              desc: 'Watch every human and bot trace their path across the map, scrubbed frame by frame.',
            },
            {
              icon: '⚡',
              title: 'Kill Zone Analysis',
              desc: 'See exactly where players die, who killed them, and which areas create frustration.',
            },
            {
              icon: '★',
              title: 'Loot & Engagement',
              desc: 'Map out loot density and compare engagement patterns across hundreds of matches.',
            },
          ].map(f => (
            <div key={f.title} className="flex gap-3">
              <span className="text-blue-500 text-lg mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <p className="text-white text-sm font-semibold mb-1">{f.title}</p>
                <p className="text-gray-600 text-xs leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-gray-900 flex items-center justify-between">
        <span className="text-gray-800 text-[10px] tracking-widest uppercase">LILA BLACK</span>
        <span className="text-gray-800 text-[10px]">Level Design Visualizer</span>
      </footer>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
