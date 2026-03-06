'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

// ── YouTube video ID — replace with your actual ID after uploading ──
const YOUTUBE_VIDEO_ID = 'YOUR_VIDEO_ID'

export default function Landing() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F4F4F0] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-gray-900 font-sans">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-900" />
          <span className="font-bold text-sm tracking-widest uppercase">LILA BLACK</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <a href="#problem" className="hover:text-gray-900 transition-colors">Problem</a>
          <a href="#solution" className="hover:text-gray-900 transition-colors">Solution</a>
          <a href="#tech" className="hover:text-gray-900 transition-colors">Tech</a>
          <a href="#architecture" className="hover:text-gray-900 transition-colors">Architecture</a>
        </div>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center gap-2 bg-purple-600 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-purple-700 transition-all disabled:opacity-50"
        >
          <GoogleIcon />
          {loading ? 'Redirecting…' : 'Sign in'}
        </button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-8">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-500 text-[11px] font-medium tracking-widest uppercase px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          APM Written Test — Lila Games
        </div>

        {/* H1 */}
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5 max-w-3xl">
          See Your Map Through<br />
          <span className="text-blue-600">Your Players&apos; Eyes</span>
        </h1>

        <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-xl">
          LILA BLACK is an AI-powered game analytics visualiser for level designers —
          turning raw telemetry into spatial insight, and spatial insight into design decisions.
        </p>

        {/* CTA row */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center gap-2.5 bg-purple-600 text-white font-semibold text-sm px-7 py-3.5 rounded-full hover:bg-purple-700 transition-all shadow-md disabled:opacity-50"
          >
            <GoogleIcon />
            {loading ? 'Redirecting…' : 'Open Dashboard'}
          </button>
          <a
            href="https://github.com/Ashwini7506/lila-black"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-medium text-sm px-6 py-3.5 rounded-full hover:border-gray-400 transition-all"
          >
            <GithubIcon />
            View on GitHub
          </a>
        </div>
      </section>

      {/* ── Video section ────────────────────────────────────────────── */}
      <section className="px-6 pb-20 pt-8 max-w-5xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white aspect-video">
          {YOUTUBE_VIDEO_ID === 'YOUR_VIDEO_ID' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-2xl">▶</div>
              <p className="text-gray-400 text-sm">Project walkthrough video — coming soon</p>
            </div>
          ) : (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`}
              title="LILA BLACK Project Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────── */}
      <section id="problem" className="px-6 py-20 max-w-5xl mx-auto">
        <SectionLabel>The Problem</SectionLabel>
        <h2 className="text-4xl font-bold mb-5 leading-tight">
          Level designers fly blind<br />after shipping a map.
        </h2>
        <p className="text-gray-500 text-lg leading-relaxed max-w-2xl mb-12">
          Playtest sessions produce thousands of raw events — positions, kills, deaths, loot pickups — but no tool translates that data into spatial, designer-readable insight. Most studios rely on memory, intuition, or expensive manual analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '🗺', title: 'No spatial context', desc: 'Raw event logs have no spatial meaning. Designers can\'t see WHERE problems are concentrated on the map.' },
            { icon: '⏱', title: 'Slow feedback loops', desc: 'Without automation, a single playtest analysis session takes hours of manual spreadsheet work.' },
            { icon: '❓', title: 'No diagnosis', desc: 'Even when patterns are found, there\'s no layer to explain WHY players behave that way or WHAT to change.' },
          ].map(c => (
            <ProblemCard key={c.title} icon={c.icon} title={c.title} desc={c.desc} />
          ))}
        </div>
      </section>

      {/* ── Solution ────────────────────────────────────────────────── */}
      <section id="solution" className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <SectionLabel light>The Solution</SectionLabel>
          <h2 className="text-4xl font-bold mb-5 leading-tight">
            LILA BLACK: an AI analyst<br />embedded in your map.
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mb-14">
            LILA BLACK ingests raw telemetry CSVs and renders them as spatial overlays on the actual map — then puts a senior playtest analyst AI on top that speaks in FINDINGs, DIAGNOSEs, and FIXes, not data dumps.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: '◎', title: 'Interactive Map Viewer', desc: 'Zoom, pan, scrub through time. Paths mode shows every player route. Heatmap mode shows density. Toggle humans vs bots, event types, or specific matches.' },
              { icon: '⚡', title: 'Region-scoped AI Chat', desc: 'Draw a rectangle on the map. Ask the AI "why do players avoid this corridor?" It queries events, runs spatial aggregates, and responds with a specific level design fix.' },
              { icon: '★', title: 'Algorithmic Annotations', desc: 'Dead zones, choke points, and storm clusters are auto-detected and rendered as pulsing rings on the map. One click → AI diagnosis in chat.' },
              { icon: '🧠', title: 'Persistent AI Memory', desc: 'Every significant finding is embedded (Transformers.js) and stored per designer per map. The AI recalls past observations in future sessions automatically.' },
              { icon: '📊', title: 'Custom KPI Formulas', desc: 'Define your own metrics: Kill / (Kill + Killed), storm deaths per match, loot coverage rate. Stored per designer, evaluated live against selected matches.' },
              { icon: '📥', title: 'CSV Upload Pipeline', desc: 'Drop in raw event CSVs. The server parses world coordinates, converts to pixel coords using MAP_CONFIGS, and batch-upserts into Supabase.' },
            ].map(f => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ──────────────────────────────────────────────── */}
      <section id="tech" className="px-6 py-20 max-w-5xl mx-auto">
        <SectionLabel>Tech Stack</SectionLabel>
        <h2 className="text-4xl font-bold mb-12 leading-tight">
          Built for zero cost,<br />production-grade output.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { layer: 'Frontend', stack: 'Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4', note: 'SSE streaming, agentic tool-call loop, canvas-based map renderer' },
            { layer: 'Database', stack: 'Supabase (PostgreSQL + pgvector)', note: 'Events table, matches table, designer_memory with 384-dim embeddings. Free tier.' },
            { layer: 'AI Model', stack: 'Claude Haiku via OpenRouter (OpenAI-compatible SDK)', note: '4 general tools: query_events, aggregate_events, get_match_summary, compare_date_labels' },
            { layer: 'Embeddings', stack: 'Transformers.js — Xenova/all-MiniLM-L6-v2 (384-dim)', note: 'Runs locally on the server. Zero API cost. Cosine similarity search in Node.js.' },
            { layer: 'Auth', stack: 'Supabase Auth — Google OAuth', note: 'designer_id = Supabase auth.users.id (separate from user_id which is a player UUID in events)' },
            { layer: 'Pipeline', stack: 'Python — pandas, supabase-py, psycopg2', note: 'event_decoder.py → coordinate_utils.py → bot_detector.py → ingest.py → Supabase' },
          ].map(t => (
            <TechCard key={t.layer} layer={t.layer} stack={t.stack} note={t.note} />
          ))}
        </div>
      </section>

      {/* ── Architecture ────────────────────────────────────────────── */}
      <section id="architecture" className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Architecture</SectionLabel>
          <h2 className="text-4xl font-bold mb-5 leading-tight">
            How data flows from<br />CSV to insight.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-12 max-w-2xl">
            Every layer was designed with a hard constraint: zero paid API calls for infrastructure. Embeddings are local. Aggregation is in-database. The AI only sees structured query results, never raw SQL.
          </p>
          <div className="space-y-3">
            {[
              { step: '01', title: 'Raw CSV', desc: 'Game server exports match_id, user_id, event_type, world coordinates (x, z), timestamp, is_bot per event.' },
              { step: '02', title: 'Python Pipeline', desc: 'event_decoder.py decodes event types. bot_detector.py flags bots. coordinate_utils.py converts world x/z → pixel_x/y (0–1024) using MAP_CONFIGS. ingest.py batch-upserts to Supabase.' },
              { step: '03', title: 'Supabase', desc: 'events table stores pixel coords + metadata. matches table stores per-match aggregates. designer_memory stores AI findings as pgvector embeddings.' },
              { step: '04', title: 'Next.js API', desc: 'Four AI tools query Supabase via supabase-admin. Spawns = first Position event per (match_id, user_id). Region filters applied as pixel bounds. Results returned as structured JSON to the AI.' },
              { step: '05', title: 'Claude Haiku', desc: 'Agentic loop: tool call → result → next tool call (or final answer). System prompt instructs FINDING → DIAGNOSIS → FIX format. Hard rule: no raw UUIDs or timestamps in output.' },
              { step: '06', title: 'Designer', desc: 'SSE stream delivers tokens word-by-word. Response auto-saved as embedding to designer_memory. Next session the AI recalls relevant past findings.' },
            ].map(s => (
              <ArchStep key={s.step} step={s.step} title={s.title} desc={s.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Design Decisions ─────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <SectionLabel>AI Design</SectionLabel>
        <h2 className="text-4xl font-bold mb-5 leading-tight">
          Why 4 tools beat 9.
        </h2>
        <p className="text-gray-500 text-lg leading-relaxed mb-12 max-w-2xl">
          The first architecture had 9 narrow, hardcoded tools — one per question type. Every new designer question required a new tool. The AI couldn&apos;t reason beyond its predefined set.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
            <p className="text-red-600 text-xs font-bold uppercase tracking-widest mb-3">Before — 9 narrow tools</p>
            <ul className="space-y-2 text-sm text-gray-700">
              {['get_kills_in_region', 'get_spawn_points', 'get_storm_deaths', 'get_loot_density', 'get_player_count', 'get_bot_ratio', 'get_match_stats', 'get_path_data', 'get_hotzone'].map(t => (
                <li key={t} className="font-mono text-xs text-red-500">{t}()</li>
              ))}
            </ul>
            <p className="text-red-500 text-xs mt-4">Each new question = new hardcoded tool. Doesn&apos;t scale.</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6">
            <p className="text-green-600 text-xs font-bold uppercase tracking-widest mb-3">After — 4 general primitives</p>
            <div className="space-y-3">
              {[
                { name: 'query_events()', desc: 'Raw rows with flexible filters. AI reasons over them directly.' },
                { name: 'aggregate_events()', desc: 'Grouped counts. group_by: event_type | user_id | match_id | is_bot | first_per_user | grid_8x8 | grid_16x16' },
                { name: 'get_match_summary()', desc: 'Match metadata as baseline context.' },
                { name: 'compare_date_labels()', desc: 'Patch impact analysis between two date periods.' },
              ].map(t => (
                <div key={t.name}>
                  <p className="font-mono text-xs text-green-600 font-semibold">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-green-600 text-xs mt-4">AI composes tools to answer any question, including ones never anticipated.</p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="bg-gray-900 text-white px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse mx-auto mb-8" />
          <h2 className="text-4xl font-bold mb-4">Try LILA BLACK</h2>
          <p className="text-gray-400 text-lg mb-10">
            Sign in with Google to access the dashboard. No setup required.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center gap-2.5 bg-purple-600 text-white font-semibold text-sm px-7 py-3.5 rounded-full hover:bg-purple-700 transition-all disabled:opacity-50"
            >
              <GoogleIcon dark />
              {loading ? 'Redirecting…' : 'Open Dashboard'}
            </button>
            <a
              href="https://github.com/Ashwini7506/lila-black"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-gray-700 text-gray-300 font-medium text-sm px-6 py-3.5 rounded-full hover:border-gray-500 hover:text-white transition-all"
            >
              <GithubIcon light />
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-8 py-5 border-t border-gray-200 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <span className="text-gray-400 text-xs tracking-widest uppercase">LILA BLACK</span>
        </div>
        <span className="text-gray-400 text-xs">APM Written Test — Lila Games 2026</span>
      </footer>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${light ? 'text-gray-500' : 'text-blue-600'}`}>
      {children}
    </p>
  )
}

function ProblemCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl mb-4">{icon}</div>
      <p className="font-semibold text-sm mb-2">{title}</p>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
      <span className="text-2xl mb-4 block">{icon}</span>
      <p className="font-semibold text-sm mb-2 text-white">{title}</p>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function TechCard({ layer, stack, note }: { layer: string; stack: string; note: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-2">{layer}</p>
      <p className="font-semibold text-sm mb-2">{stack}</p>
      <p className="text-gray-500 text-xs leading-relaxed">{note}</p>
    </div>
  )
}

function ArchStep({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start bg-[#F4F4F0] rounded-2xl p-5">
      <span className="text-gray-300 font-bold text-xl shrink-0 w-8">{step}</span>
      <div>
        <p className="font-semibold text-sm mb-1">{title}</p>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function GoogleIcon({ dark }: { dark?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill={dark ? '#4285F4' : '#4285F4'} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function GithubIcon({ light }: { light?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={light ? '#9CA3AF' : '#374151'}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}
