'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'

// ── Replace with your YouTube video ID after uploading ──────────────────────
const VIDEO_ID = 'YOUR_VIDEO_ID'

// ── Feature list with timestamps (seconds) — update after recording ─────────
const FEATURES = [
  { icon: '◎', title: 'Interactive Map Viewer',     desc: 'Zoom, pan, scrub through time. Paths mode shows every player route. Heatmap shows density. Toggle humans, bots, or specific matches.', ts: 0   },
  { icon: '⚡', title: 'Region-scoped AI Chat',      desc: 'Draw a rectangle on the map. Ask "why do players avoid this corridor?" — the AI queries events and returns a specific level design fix.', ts: 30  },
  { icon: '★',  title: 'Algorithmic Annotations',    desc: 'Dead zones, choke points, and storm clusters auto-detected and rendered as pulsing rings. One click → AI diagnosis.', ts: 60  },
  { icon: '🧠', title: 'Persistent AI Memory',       desc: 'Every significant finding is embedded locally (Transformers.js) and stored per designer per map. The AI recalls past observations automatically.', ts: 90  },
  { icon: '📊', title: 'Custom KPI Formulas',        desc: 'Define your own metrics: Kill / (Kill + Killed), storm deaths per match. Stored per designer, evaluated live against selected matches.', ts: 120 },
  { icon: '📥', title: 'CSV Upload Pipeline',        desc: 'Drop in raw event CSVs. Server converts world coordinates to pixel coords via MAP_CONFIGS and batch-upserts to Supabase.', ts: 150 },
]

export default function Landing() {
  const router   = useRouter()
  const [loading,    setLoading]    = useState(false)
  const [checking,   setChecking]   = useState(true)
  const [activeFeature, setActiveFeature] = useState(0)

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

  const videoSrc = VIDEO_ID === 'YOUR_VIDEO_ID'
    ? null
    : `https://www.youtube.com/embed/${VIDEO_ID}?start=${FEATURES[activeFeature].ts}&autoplay=1`

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F4F4F0] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-[#F4F4F0] text-gray-900 font-sans">

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-900" />
          <span className="font-bold text-sm tracking-widest uppercase">LILA BLACK</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <a href="#problem"      className="hover:text-gray-900 transition-colors">Problem</a>
          <a href="#solution"     className="hover:text-gray-900 transition-colors">Solution</a>
          <a href="#tech"         className="hover:text-gray-900 transition-colors">Tech</a>
          <a href="#architecture" className="hover:text-gray-900 transition-colors">Architecture</a>
        </div>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-gray-700 transition-all disabled:opacity-50"
        >
          <GoogleIcon />
          {loading ? 'Redirecting…' : 'Sign in'}
        </button>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-8">
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-500 text-[11px] font-medium tracking-widest uppercase px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          APM Written Test — Lila Games
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5 max-w-3xl">
          See Your Map Through<br />
          <span className="text-blue-600">Your Players&apos; Eyes</span>
        </h1>

        <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-xl">
          LILA BLACK is an AI-powered game analytics visualiser for level designers —
          turning raw telemetry into spatial insight, and spatial insight into design decisions.
        </p>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex items-center gap-2.5 bg-gray-900 text-white font-semibold text-sm px-7 py-3.5 rounded-full hover:bg-gray-700 transition-all shadow-md disabled:opacity-50"
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

      {/* ── Hero video ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-20 pt-8 max-w-5xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white aspect-video">
          {!videoSrc ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">▶</div>
              <p className="text-gray-400 text-sm">Project walkthrough — video coming soon</p>
            </div>
          ) : (
            <iframe
              key={videoSrc}
              className="absolute inset-0 w-full h-full"
              src={videoSrc}
              title="LILA BLACK Project Walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────────────── */}
      <section id="problem" className="px-6 py-20 max-w-5xl mx-auto">
        <SectionLabel>The Problem</SectionLabel>
        <h2 className="text-4xl font-bold mb-5 leading-tight">
          Level designers fly blind<br />after shipping a map.
        </h2>
        <p className="text-gray-500 text-lg leading-relaxed max-w-2xl mb-12">
          Playtest sessions produce thousands of raw events — positions, kills, deaths, loot pickups — but no tool
          translates that data into spatial, designer-readable insight. Most studios rely on memory, intuition,
          or expensive manual analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '🗺', title: 'No spatial context',    desc: "Raw event logs have no spatial meaning. Designers can't see WHERE problems are concentrated on the map." },
            { icon: '⏱', title: 'Slow feedback loops',   desc: 'Without automation, a single playtest analysis session takes hours of manual spreadsheet work.' },
            { icon: '❓', title: 'No diagnosis',          desc: "Even when patterns are found, there's no layer to explain WHY players behave that way or WHAT to change." },
          ].map(c => (
            <div key={c.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl mb-4">{c.icon}</div>
              <p className="font-semibold text-sm mb-2">{c.title}</p>
              <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Solution ───────────────────────────────────────────────────── */}
      <section id="solution" className="bg-gray-900 text-white px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <SectionLabel light>The Solution</SectionLabel>
          <h2 className="text-4xl font-bold mb-3 leading-tight">
            LILA BLACK: an AI analyst<br />embedded in your map.
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl mb-12">
            Click any feature to see it in action.
          </p>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left — feature list */}
            <div className="flex flex-col gap-3 lg:w-[42%] shrink-0">
              {FEATURES.map((f, i) => (
                <button
                  key={f.title}
                  onClick={() => setActiveFeature(i)}
                  className={`text-left rounded-xl p-4 border transition-all ${
                    activeFeature === i
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg">{f.icon}</span>
                    <p className={`font-semibold text-sm ${activeFeature === i ? 'text-white' : 'text-gray-300'}`}>{f.title}</p>
                    {activeFeature === i && <span className="ml-auto text-blue-400 text-xs">▶ playing</span>}
                  </div>
                  {activeFeature === i && (
                    <p className="text-gray-400 text-xs leading-relaxed pl-9">{f.desc}</p>
                  )}
                </button>
              ))}
            </div>

            {/* Right — video player */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 bg-white/5 aspect-video relative">
              {!videoSrc ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl">▶</div>
                  <p className="text-gray-500 text-sm">{FEATURES[activeFeature].title}</p>
                  <p className="text-gray-600 text-xs">Video coming soon</p>
                </div>
              ) : (
                <iframe
                  key={`${VIDEO_ID}-${activeFeature}`}
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${VIDEO_ID}?start=${FEATURES[activeFeature].ts}&autoplay=1`}
                  title={FEATURES[activeFeature].title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech Stack ─────────────────────────────────────────────────── */}
      <section id="tech" className="px-6 py-20 max-w-5xl mx-auto">
        <SectionLabel>Tech Stack</SectionLabel>
        <h2 className="text-4xl font-bold mb-12 leading-tight">
          What&apos;s powering it<br />under the hood.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { layer: 'Frontend',   stack: 'Next.js · React 19 · TypeScript · Tailwind CSS', note: 'The web app — real-time map rendering, AI chat panel, interactive controls.' },
            { layer: 'Database',   stack: 'Supabase (free tier)',                           note: 'Stores all player events, match records, and the AI\'s memory of past findings.' },
            { layer: 'AI Model',   stack: 'Claude Haiku (Anthropic)',                       note: 'Powers the chat analyst. Reads match data and returns a finding, diagnosis, and fix.' },
            { layer: 'AI Memory',  stack: 'Local semantic search model',                    note: 'Runs on the server at zero cost. Saves and recalls past insights per designer, per map.' },
            { layer: 'Auth',       stack: 'Google Sign-In via Supabase',                    note: 'Each designer has their own profile, saved KPIs, and AI memory — all private.' },
            { layer: 'Pipeline',   stack: 'Python scripts',                                 note: 'Processes raw game event files and loads them into the database ready for analysis.' },
          ].map(t => (
            <div key={t.layer} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-2">{t.layer}</p>
              <p className="font-semibold text-sm mb-2">{t.stack}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{t.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture ───────────────────────────────────────────────── */}
      <section id="architecture" className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="text-4xl font-bold mb-5 leading-tight">
            From a playtest session<br />to a design decision.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-14 max-w-2xl">
            Six steps — from raw game data to an AI telling you exactly what to change on your map.
          </p>

          {/* Flowchart */}
          <div className="overflow-x-auto pb-4">
            <div className="flex items-start gap-0 min-w-[700px]">
              {[
                { label: 'Game Events',     color: 'bg-gray-100 border-gray-200',            dot: 'bg-gray-400',   lines: ['Every kill', 'Every death', 'Every movement', 'Every item pickup'] },
                { label: 'Clean & Process', color: 'bg-blue-50 border-blue-100',              dot: 'bg-blue-400',   lines: ['Bots separated', 'from real players', 'Positions mapped', 'to the visual map'] },
                { label: 'Store',           color: 'bg-green-50 border-green-100',            dot: 'bg-green-500',  lines: ['All events saved', 'per match', 'AI memory stored', 'per designer'] },
                { label: 'Smart Queries',   color: 'bg-purple-50 border-purple-100',          dot: 'bg-purple-500', lines: ['Filter by area', 'Filter by match', 'Filter by event', 'Instant results'] },
                { label: 'AI Analysis',     color: 'bg-orange-50 border-orange-100',          dot: 'bg-orange-400', lines: ['Reads the data', 'Forms a diagnosis', 'Suggests a fix', 'In plain English'] },
                { label: 'You See This',    color: 'bg-gray-900 border-gray-800',             dot: 'bg-white',      lines: ['Map overlays', 'AI chat panel', 'Past observations', 'Custom metrics'] },
              ].map((node, i, arr) => (
                <div key={node.label} className="flex items-center flex-1">
                  <div className={`flex-1 rounded-2xl border p-4 ${node.color}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${node.dot}`} />
                      <p className={`font-bold text-xs uppercase tracking-wider ${node.label === 'You See This' ? 'text-white' : 'text-gray-700'}`}>{node.label}</p>
                    </div>
                    <ul className="space-y-1">
                      {node.lines.map(l => (
                        <li key={l} className={`text-[11px] ${node.label === 'You See This' ? 'text-gray-400' : 'text-gray-500'}`}>{l}</li>
                      ))}
                    </ul>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex flex-col items-center px-1 shrink-0">
                      <div className="w-6 h-px bg-gray-300" />
                      <span className="text-gray-300 text-xs">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Key design decisions — plain language */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {[
              { title: 'Handles hundreds of matches', desc: 'The system was built to analyse 199+ matches at once without slowing down. All counting happens where the data lives — results come back instantly.' },
              { title: 'AI that remembers you',        desc: 'Every insight the AI surfaces is saved automatically. Next session, it recalls what it found before — no repeating yourself, no starting from scratch.' },
              { title: 'Built at zero infrastructure cost', desc: 'The AI memory search runs entirely on the server using a local model — no paid APIs for it. The whole product runs on free-tier services.' },
            ].map(d => (
              <div key={d.title} className="bg-[#F4F4F0] rounded-2xl p-5">
                <p className="font-semibold text-sm mb-2">{d.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why this architecture ──────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <SectionLabel>Why This Architecture</SectionLabel>
        <h2 className="text-4xl font-bold mb-5 leading-tight">
          Built to scale, not just<br />to finish the assignment.
        </h2>
        <p className="text-gray-500 text-lg leading-relaxed mb-12 max-w-2xl">
          Every technical decision was made with one question in mind: what happens when a studio needs this at scale, across multiple maps, teams, and game titles?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: 'A real database, not a static file',
              desc: 'Most quick prototypes read from a CSV or JSON file. LILA BLACK uses a proper relational database with a structured data pipeline. New match data can be added at any time without touching the codebase — just run the pipeline.',
            },
            {
              title: 'AI memory that actually learns from you',
              desc: 'The AI has a RAG (Retrieval Augmented Generation) architecture built in. Every finding it surfaces is saved as a searchable memory, scoped to you and your map. The longer you use it, the more context it carries into future sessions.',
            },
            {
              title: 'Designed for personal training',
              desc: 'Because memory is stored per designer, each person\'s AI gradually reflects their own way of thinking about level design. You can also add manual notes to its memory. In the future this becomes the foundation for a personalised AI co-designer.',
            },
            {
              title: 'A path to MCP integration',
              desc: 'The vector database layer is the foundation for an MCP (Model Context Protocol) server — a direct bridge between this tool and the game engine. A level designer or developer could get AI analysis injected into their editor in real time, without opening a browser.',
            },
          ].map(d => (
            <div key={d.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="font-semibold text-sm mb-2">{d.title}</p>
              <p className="text-gray-500 text-sm leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trade-offs & What's Next ────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Trade-offs & What&apos;s Next</SectionLabel>
          <h2 className="text-4xl font-bold mb-5 leading-tight">
            Honest about what<br />I had to compromise on.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-12 max-w-2xl">
            Every build under a deadline involves choices. Here is what I traded off, why, and what I would fix first with more time.
          </p>

          {/* Trade-offs */}
          <div className="space-y-4 mb-14">
            {[
              {
                label: 'Trade-off 1',
                title: 'A less powerful AI model to control cost',
                desc: 'The tool currently uses Claude Haiku — Anthropic\'s fastest and cheapest model. A more capable model (Claude Sonnet) would produce significantly better diagnoses and multi-step reasoning, but at 5–10× the API cost per query. To keep this viable for a real studio at scale, the upgrade needs to come with smarter caching and query batching first.',
                color: 'border-l-blue-400',
              },
              {
                label: 'Trade-off 2',
                title: 'Split between algorithm and AI to keep responses fast',
                desc: 'Dead zones, choke points, and storm clusters are detected by fixed algorithms, not by the AI. This is intentional — the AI answering these from scratch on every load would take 30–60 seconds and cost significantly more. The algorithm flags the pattern; the AI only explains it when you ask. This keeps the tool feeling instant.',
                color: 'border-l-orange-400',
              },
              {
                label: 'Trade-off 3',
                title: 'Free database tier limits how much data the AI can see at once',
                desc: 'Supabase\'s free tier caps how many rows can be returned in a single database call. The AI could in theory ask for all 89,000+ events and reason over everything — but that would take 4–5 minutes and cost a lot per query. The current design works around this by giving the AI smarter, aggregated summaries instead of raw rows. A paid tier or a self-hosted database removes this constraint entirely.',
                color: 'border-l-red-400',
              },
            ].map(t => (
              <div key={t.title} className={`bg-[#F4F4F0] rounded-2xl p-6 border-l-4 ${t.color}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{t.label}</p>
                <p className="font-semibold text-sm mb-2">{t.title}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* What's next */}
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-4">With More Time</p>
          <h3 className="text-2xl font-bold mb-8">The full vision: an AI co-designer inside your game engine.</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                title: 'Named Zones',
                desc: 'Let designers label areas on their map — "North Warehouse", "Bridge", "Dead End Alley". All AI responses and annotations reference these names instead of coordinates. Without this, locations are meaningless to a non-technical designer.',
              },
              {
                step: '02',
                title: 'Design Intent Layer',
                desc: 'Designer marks a zone and declares what it was meant to do — "flanking route", "high-traffic loot area", "sniper nest". The AI compares actual player behaviour against the stated intent and surfaces the gap. This is the core value of a real playtest tool.',
              },
              {
                step: '03',
                title: 'MCP Server in the Game Engine',
                desc: 'Build a Model Context Protocol server over the existing vector memory layer. This creates a direct bridge between LILA BLACK and the level editor — AI analysis, past playtest findings, and design suggestions delivered inside the tool the designer already has open.',
              },
            ].map(n => (
              <div key={n.step} className="bg-gray-900 text-white rounded-2xl p-6">
                <p className="text-gray-600 font-bold text-xl mb-3">{n.step}</p>
                <p className="font-semibold text-sm mb-2">{n.title}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
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
              className="flex items-center gap-2.5 bg-white text-gray-900 font-semibold text-sm px-7 py-3.5 rounded-full hover:bg-gray-100 transition-all disabled:opacity-50"
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

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="px-8 py-5 border-t border-gray-200 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <span className="text-gray-400 text-xs tracking-widest uppercase">LILA BLACK</span>
        </div>
        <span className="text-gray-400 text-xs">APM Written Test — Lila Games 2026</span>
      </footer>

    </div>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

function SectionLabel({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${light ? 'text-gray-500' : 'text-blue-600'}`}>
      {children}
    </p>
  )
}

function GoogleIcon({ dark }: { dark?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
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
