'use client'
import { MapId, EventType, Match, Insight } from '@/types'

type InsightType = Insight['type']

const INSIGHT_TOGGLES: { type: InsightType; label: string; color: string }[] = [
  { type: 'combat_hotspot',   label: 'Combat Hotspot',  color: '#f472b6' },
  { type: 'frustration_zone', label: 'Frustration Zone', color: '#ef4444' },
  { type: 'hot_drop',         label: 'Hot Drop',         color: '#facc15' },
  { type: 'choke_point',      label: 'Choke Point',      color: '#fb923c' },
  { type: 'storm_cluster',    label: 'Storm Cluster',    color: '#a78bfa' },
  { type: 'loot_black_hole',  label: 'Loot Black Hole', color: '#34d399' },
  { type: 'dead_zone',        label: 'Dead Zone',        color: '#3b82f6' },
]

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown']
const DATES = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14']
const EVENT_TOGGLES: { type: EventType; label: string; color: string; symbol: string; tooltip: string }[] = [
  { type: 'Kill',          label: 'MH × H',      color: '#EF4444', symbol: '●', tooltip: 'Main Human kills a Human' },
  { type: 'Killed',        label: 'H × MH',      color: '#991B1B', symbol: '✕', tooltip: 'Human kills Main Human' },
  { type: 'BotKill',       label: 'MH × B',      color: '#F97316', symbol: '●', tooltip: 'Main Human kills a Bot' },
  { type: 'BotKilled',     label: 'B × MH',      color: '#A855F7', symbol: '✕', tooltip: 'Bot kills Main Human' },
  { type: 'KilledByStorm', label: 'Storm × MH',  color: '#8B5CF6', symbol: '⚡', tooltip: 'Storm kills Main Human' },
  { type: 'Loot',          label: 'Loot',         color: '#FCD34D', symbol: '★', tooltip: 'Main Human picks up loot' },
]

// Matches MATCH_COLORS in MapViewer
const MATCH_COLORS = [
  '#60A5FA', '#34D399', '#F87171', '#FBBF24', '#A78BFA',
  '#F472B6', '#4ADE80', '#FB923C', '#38BDF8', '#E879F9',
  '#67E8F9', '#86EFAC', '#FCA5A5', '#FDE68A', '#C4B5FD',
]

interface Props {
  mapId: MapId
  dateLabel: string
  matchIds: string[]
  matches: Match[]
  showHumans: boolean
  showBots: boolean
  activeEventTypes: EventType[]
  viewMode: 'paths' | 'heatmap'
  showInsights: boolean
  activeInsightTypes: InsightType[]
  selectedRegion: { x1: number; y1: number; x2: number; y2: number } | null
  onMapChange: (m: MapId) => void
  onDateChange: (d: string) => void
  onMatchToggle: (id: string) => void
  onClearMatches: () => void
  onSelectAllMatches: () => void
  onToggleHumans: () => void
  onToggleBots: () => void
  onToggleEventType: (t: EventType) => void
  onViewModeChange: (v: 'paths' | 'heatmap') => void
  onToggleInsights: () => void
  onToggleInsightType: (t: InsightType) => void
  onClearRegion: () => void
}

export default function Sidebar({
  mapId, dateLabel, matchIds, matches,
  showHumans, showBots, activeEventTypes, viewMode, showInsights, activeInsightTypes, selectedRegion,
  onMapChange, onDateChange, onMatchToggle, onClearMatches, onSelectAllMatches, onToggleHumans, onToggleBots,
  onToggleEventType, onViewModeChange, onToggleInsights, onToggleInsightType, onClearRegion,
}: Props) {
  return (
    <aside className="w-60 bg-gray-950 border-r border-gray-800 flex flex-col overflow-y-auto shrink-0">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-glow-pulse" />
          <h1 className="text-white font-bold text-sm tracking-widest uppercase">LILA BLACK</h1>
        </div>
        <p className="text-gray-600 text-xs mt-0.5 pl-4">Level Design Visualizer</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Map */}
        <Field label="Map">
          <select
            value={mapId}
            onChange={e => onMapChange(e.target.value as MapId)}
            className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>

        {/* Date */}
        <Field label="Date">
          <select
            value={dateLabel}
            onChange={e => onDateChange(e.target.value)}
            className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {DATES.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
          </select>
        </Field>

        {/* Matches */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <SectionLabel>Matches</SectionLabel>
              {matchIds.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {matchIds.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {matches.length > 0 && matchIds.length < matches.length && (
                <button onClick={onSelectAllMatches} className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors">
                  All
                </button>
              )}
              {matchIds.length > 0 && (
                <button onClick={onClearMatches} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
          {matches.length === 0 ? (
            <p className="text-xs text-gray-700 italic">Select a map &amp; date</p>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
              {matches.map((m, idx) => {
                const checked = matchIds.includes(m.match_id)
                const color = MATCH_COLORS[idx % MATCH_COLORS.length]
                return (
                  <label
                    key={m.match_id}
                    className={`relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all group ${
                      checked
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'
                    }`}
                    style={checked ? { borderLeft: `2px solid ${color}` } : { borderLeft: '2px solid transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onMatchToggle(m.match_id)}
                      className="sr-only"
                    />
                    {/* Color chip */}
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
                      style={{ background: checked ? color : '#374151' }}
                    />
                    <span className="text-xs flex-1 truncate">Match #{m.map_match_number}</span>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {m.human_count}H
                    </span>
                    {/* Hover tooltip */}
                    <div className="absolute left-full ml-2 top-0 z-50 w-44 bg-gray-900 border border-gray-700 rounded-lg p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                      <p className="text-white text-[11px] font-semibold mb-1.5">Match #{m.map_match_number}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[10px]">ID</span>
                          <span className="text-gray-300 text-[10px] font-mono">{m.match_id.slice(0, 8)}…</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[10px]">Date</span>
                          <span className="text-gray-300 text-[10px]">{m.date_label.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[10px]">Events</span>
                          <span className="text-gray-300 text-[10px]">{m.total_events.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[10px]">Humans</span>
                          <span className="text-gray-300 text-[10px]">{m.human_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[10px]">Map</span>
                          <span className="text-gray-300 text-[10px]">{m.map_id}</span>
                        </div>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <Divider />

        {/* View mode */}
        <Field label="View">
          <div className="flex gap-1.5 bg-gray-900 p-1 rounded-lg border border-gray-800">
            {(['paths', 'heatmap'] as const).map(v => (
              <button
                key={v}
                onClick={() => onViewModeChange(v)}
                className={`flex-1 py-1.5 text-xs rounded-md capitalize font-medium transition-all ${
                  viewMode === v
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>

        {/* Players */}
        <Field label="Players">
          <div className="flex gap-1.5">
            <Toggle active={showHumans} onClick={onToggleHumans} color="bg-blue-600" activeGlow="shadow-blue-900">
              Humans
            </Toggle>
            <Toggle active={showBots} onClick={onToggleBots} color="bg-gray-700" activeGlow="shadow-gray-700">
              Bots
            </Toggle>
          </div>
        </Field>

        {/* Events */}
        <div>
          <SectionLabel className="mb-2">Events</SectionLabel>
          <div className="space-y-1">
            {EVENT_TOGGLES.map(({ type, label, color, symbol, tooltip }) => {
              const on = activeEventTypes.includes(type)
              return (
                <label key={type} className="relative flex items-center gap-2.5 cursor-pointer group py-0.5">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggleEventType(type)}
                    className="sr-only"
                  />
                  <span
                    className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[9px] transition-all border"
                    style={on
                      ? { background: color + '22', borderColor: color, color }
                      : { background: 'transparent', borderColor: '#374151', color: 'transparent' }
                    }
                  >
                    {symbol}
                  </span>
                  <span className={`text-xs transition-colors ${on ? 'text-gray-200' : 'text-gray-600 group-hover:text-gray-400'}`}>
                    {label}
                  </span>
                  <span className="absolute left-0 -top-7 bg-gray-800 border border-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {tooltip}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <Divider />

        {/* Overlays */}
        <Field label="Overlays">
          <Toggle active={showInsights} onClick={onToggleInsights} color="bg-orange-700" activeGlow="shadow-orange-900">
            Insights Layer
          </Toggle>
          {showInsights && (
            <div className="mt-2 space-y-1">
              {INSIGHT_TOGGLES.map(({ type, label, color }) => {
                const active = activeInsightTypes.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => onToggleInsightType(type)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                      active ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: active ? color : '#374151' }}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </Field>

        {/* Selected region */}
        {selectedRegion && (
          <div className="bg-blue-950/50 border border-blue-800 rounded-lg p-3 animate-fade-slide">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs text-blue-300 font-medium">Region Selected</span>
              </div>
              <button onClick={onClearRegion} className="text-gray-600 hover:text-white text-xs transition-colors">✕</button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 pl-3">
              {Math.round(Math.abs(selectedRegion.x2 - selectedRegion.x1))} × {Math.round(Math.abs(selectedRegion.y2 - selectedRegion.y1))} px
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <SectionLabel className="mb-1.5">{label}</SectionLabel>}
      {children}
    </div>
  )
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-gray-500 text-[10px] uppercase tracking-widest font-semibold ${className}`}>
      {children}
    </p>
  )
}

function Divider() {
  return <div className="h-px bg-gray-800" />
}

function Toggle({ active, onClick, color, activeGlow, children }: {
  active: boolean; onClick: () => void; color: string; activeGlow: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
        active ? `${color} text-white shadow-sm ${activeGlow}` : 'bg-gray-900 text-gray-600 border border-gray-800 hover:border-gray-600 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}
