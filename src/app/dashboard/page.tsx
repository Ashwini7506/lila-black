'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MapId, EventType, Insight } from '@/types'

type InsightType = Insight['type']
const ALL_INSIGHT_TYPES: InsightType[] = ['combat_hotspot', 'frustration_zone', 'hot_drop', 'choke_point', 'storm_cluster', 'loot_black_hole', 'dead_zone']
import { useMatchData, useMatches } from '@/hooks/useMatchData'
import { usePlayback } from '@/hooks/usePlayback'
import { useInsights } from '@/hooks/useInsights'
import { useRegionSelect } from '@/hooks/useRegionSelect'
import { useAIChat } from '@/hooks/useAIChat'
import MapViewer from '@/components/MapViewer'
import Sidebar from '@/components/Sidebar'
import Timeline from '@/components/Timeline'
import KPIPanel from '@/components/KPIPanel'
import InsightsOverlay from '@/components/InsightsOverlay'
import AIAssistant from '@/components/AIAssistant'
import CSVUpload from '@/components/CSVUpload'
import KPIBuilder from '@/components/KPIBuilder'
import MemoryPanel from '@/components/MemoryPanel'
import { supabase } from '@/utils/supabase'
import { useAIAnnotations } from '@/hooks/useAIAnnotations'
import { AIAnnotation } from '@/types'

const ALL_EVENT_TYPES: EventType[] = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string; avatar_url?: string; display_name?: string } | null>(null)
  const [designerId, setDesignerId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/')
        return
      }
      setDesignerId(session.user.id)
      setUser({
        email: session.user.email,
        avatar_url: session.user.user_metadata?.avatar_url,
        display_name: session.user.user_metadata?.full_name ?? session.user.email,
      })
      setAuthChecked(true)

      // Upsert designer profile
      await supabase.from('designers').upsert({
        designer_id: session.user.id,
        email: session.user.email ?? null,
        display_name: session.user.user_metadata?.full_name ?? session.user.email ?? null,
        avatar_url: session.user.user_metadata?.avatar_url ?? null,
      }, { onConflict: 'designer_id' })
    })
  }, [router])

  const [mapId, setMapId] = useState<MapId>('AmbroseValley')
  const [dateLabel, setDateLabel] = useState('February_10')
  const [matchIds, setMatchIds] = useState<string[]>([])
  const [showHumans, setShowHumans] = useState(true)
  const [showBots, setShowBots] = useState(true)
  const [activeEventTypes, setActiveEventTypes] = useState<EventType[]>(ALL_EVENT_TYPES)
  const [viewMode, setViewMode] = useState<'paths' | 'heatmap'>('paths')
  const [showInsights, setShowInsights] = useState(true)
  const [activeInsightTypes, setActiveInsightTypes] = useState<InsightType[]>(ALL_INSIGHT_TYPES)
  const [showInsightsPanel, setShowInsightsPanel] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showKPIBuilder, setShowKPIBuilder] = useState(false)
  const [kpiRefreshKey, setKpiRefreshKey] = useState(0)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [showMemoryPanel, setShowMemoryPanel] = useState(false)

  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null)

  const { matches } = useMatches(mapId, dateLabel)
  const { events, loading } = useMatchData(matchIds)
  const playbackEvents = highlightedMatchId
    ? events.filter(e => e.match_id === highlightedMatchId)
    : events
  const playback = usePlayback(playbackEvents)
  const { insights } = useInsights(mapId)
  const { annotations, loading: annotationsLoading } = useAIAnnotations(matchIds, mapId)
  const region = useRegionSelect()
  const ai = useAIChat(matchIds, mapId, region.selectedRegion, designerId)

  const toggleEventType = (t: EventType) =>
    setActiveEventTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )

  const handleAnnotationAsk = (ann: AIAnnotation) => {
    setShowAI(true)
    ai.sendMessage(`This area on the map has been flagged: "${ann.label}". ${ann.description} Can you help diagnose why this is happening and suggest specific level design changes to fix it?`)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (!authChecked) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-glow-pulse" />
          <p className="text-gray-600 text-xs tracking-widest uppercase">Loading</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex bg-gray-950 text-white overflow-hidden">
      <Sidebar
        mapId={mapId}
        dateLabel={dateLabel}
        matchIds={matchIds}
        matches={matches}
        showHumans={showHumans}
        showBots={showBots}
        activeEventTypes={activeEventTypes}
        viewMode={viewMode}
        showInsights={showInsights}
        activeInsightTypes={activeInsightTypes}
        selectedRegion={region.selectedRegion}
        onMapChange={(m) => { setMapId(m); setMatchIds([]) }}
        onDateChange={(d) => { setDateLabel(d); setMatchIds([]) }}
        onMatchToggle={(id) => setMatchIds(prev =>
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )}
        onClearMatches={() => setMatchIds([])}
        onSelectAllMatches={() => setMatchIds(matches.map(m => m.match_id))}
        onToggleHumans={() => setShowHumans(p => !p)}
        onToggleBots={() => setShowBots(p => !p)}
        onToggleEventType={toggleEventType}
        onViewModeChange={setViewMode}
        onToggleInsights={() => setShowInsights(p => !p)}
        onToggleInsightType={(t) => setActiveInsightTypes(prev =>
          prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
        )}
        onClearRegion={region.clearRegion}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-11 bg-gray-950 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
          {matchIds.length > 0 ? (
            <div className="flex items-center gap-2 animate-fade-slide">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-glow-pulse" />
              {matchIds.length === 1 ? (
                <span className="text-xs text-gray-400 font-mono">{matchIds[0].slice(0, 16)}…</span>
              ) : (
                <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                  {matchIds.length} matches
                </span>
              )}
              <span className="text-gray-700">·</span>
              <span className="text-xs text-blue-400 tabular-nums">{events.length.toLocaleString()} events</span>
            </div>
          ) : (
            <span className="text-xs text-gray-700 italic">Select a match to begin</span>
          )}
          {loading && (
            <span className="text-xs text-blue-400 animate-pulse bg-blue-950 px-2 py-0.5 rounded">
              Loading…
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {annotationsLoading && (
              <span className="text-[10px] text-purple-400 animate-pulse bg-purple-950/40 px-2 py-0.5 rounded">
                AI analyzing…
              </span>
            )}
            {annotations.length > 0 && (
              <button
                onClick={() => setShowAnnotations(p => !p)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  showAnnotations
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-600/50'
                    : 'bg-gray-900 text-gray-600 border border-gray-800 line-through'
                }`}
                title={showAnnotations ? 'Hide AI annotations' : 'Show AI annotations'}
              >
                ◎ AI Rings {showAnnotations ? `(${annotations.length})` : `(${annotations.length}) off`}
              </button>
            )}

            <button
              onClick={() => setShowUpload(p => !p)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all bg-gray-900 text-gray-500 border border-gray-800 hover:border-blue-700 hover:text-blue-400"
            >
              ↑ Upload CSV
            </button>

            <button
              onClick={() => setShowKPIBuilder(p => !p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                showKPIBuilder
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-purple-700 hover:text-purple-400'
              }`}
            >
              ƒ KPI Builder
            </button>

            <button
              onClick={() => setShowInsightsPanel(p => !p)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                showInsightsPanel
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-orange-700 hover:text-orange-400'
              }`}
            >
              ⚠ Insights
            </button>

            {/* User menu */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-800 flex items-center justify-center text-[10px] font-bold text-blue-200">
                  {user?.email?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <span className="text-gray-500 text-[11px] hidden sm:block max-w-32 truncate">
                {user?.display_name ?? user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-[11px] text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Map + insights row */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative overflow-hidden bg-gray-950">
            <MapViewer
              mapId={mapId}
              events={events}
              currentTime={playback.currentTime}
              showHumans={showHumans}
              showBots={showBots}
              activeEventTypes={activeEventTypes}
              viewMode={viewMode}
              insights={insights.filter(i => activeInsightTypes.includes(i.type))}
              showInsights={showInsights}
              matchIds={matchIds}
              matches={matches}
              selectedRegion={region.selectedRegion}
              draftRegion={region.draftRegion}
              onMouseDown={region.onMouseDown}
              onMouseMove={region.onMouseMove}
              onMouseUp={region.onMouseUp}
              highlightedMatchId={highlightedMatchId}
              onHighlightChange={setHighlightedMatchId}
              annotations={annotations}
              showAnnotations={showAnnotations}
              onAnnotationAsk={handleAnnotationAsk}
              onSetRegion={region.setRegion}
            />
            {matchIds.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm bg-gray-950/70 px-4 py-2 rounded-lg backdrop-blur-sm">
                  Select a match to overlay data
                </p>
              </div>
            )}
          </div>

          {showInsightsPanel && (
            <div className="w-64 bg-gray-900 border-l border-gray-700 flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b border-gray-700 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Insights</span>
                <button onClick={() => setShowInsightsPanel(false)} className="text-gray-600 hover:text-white text-xs">✕</button>
              </div>
              <InsightsOverlay insights={insights.filter(i => activeInsightTypes.includes(i.type))} />
            </div>
          )}
        </div>

        <Timeline
          currentTime={playback.currentTime}
          isPlaying={playback.isPlaying}
          speed={playback.speed}
          minTime={playback.minTime}
          maxTime={playback.maxTime}
          duration={playback.duration}
          matchCount={highlightedMatchId ? 1 : matchIds.length}
          onTogglePlay={playback.togglePlay}
          onSeek={playback.seek}
          onSetSpeed={playback.setSpeed}
        />

        <AIAssistant
          messages={ai.messages}
          isLoading={ai.isLoading}
          statusText={ai.statusText}
          onSend={ai.sendMessage}
          onClear={ai.clearMessages}
          isOpen={showAI}
          onToggle={() => setShowAI(p => !p)}
          onOpenMemory={() => setShowMemoryPanel(p => !p)}
        />
      </div>

      <KPIPanel
        events={events}
        selectedRegion={region.selectedRegion}
        currentTime={matchIds.length === 1 ? playback.currentTime : Infinity}
        refreshKey={kpiRefreshKey}
      />

      {showUpload && (
        <CSVUpload
          onClose={() => setShowUpload(false)}
          onSuccess={() => setShowUpload(false)}
        />
      )}

      {showKPIBuilder && (
        <KPIBuilder
          onClose={() => setShowKPIBuilder(false)}
          onKPIsChanged={() => setKpiRefreshKey(k => k + 1)}
        />
      )}

      {showMemoryPanel && designerId && (
        <MemoryPanel
          designerId={designerId}
          mapId={mapId}
          onClose={() => setShowMemoryPanel(false)}
        />
      )}
    </div>
  )
}
