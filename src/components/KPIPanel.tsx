'use client'
import { useMemo, useState, useEffect } from 'react'
import { PlayerEvent, Region, CustomKPI, EventType } from '@/types'
import { supabase } from '@/utils/supabase'

const KPI_EVENT_VARS: EventType[] = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']

function inRegion(e: PlayerEvent, r: Region | null) {
  if (!r) return true
  return e.pixel_x >= Math.min(r.x1, r.x2) && e.pixel_x <= Math.max(r.x1, r.x2)
    && e.pixel_y >= Math.min(r.y1, r.y2) && e.pixel_y <= Math.max(r.y1, r.y2)
}

function evalKPI(formula: string, counts: Record<string, number>): string {
  try {
    const argNames = KPI_EVENT_VARS as string[]
    const argValues = argNames.map(v => counts[v] ?? 0)
    // eslint-disable-next-line no-new-func
    const result = new Function(...argNames, 'return ' + formula)(...argValues)
    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) return '—'
    return result.toFixed(3).replace(/\.?0+$/, '')
  } catch {
    return '—'
  }
}

interface Props {
  events: PlayerEvent[]
  selectedRegion: Region | null
  currentTime: number
  refreshKey?: number
}

export default function KPIPanel({ events, selectedRegion, currentTime, refreshKey }: Props) {
  const stats = useMemo(() => {
    const visible = events.filter(e => e.ts <= currentTime && inRegion(e, selectedRegion))
    const kills       = visible.filter(e => e.event_type === 'Kill').length
    const pvpDeaths   = visible.filter(e => e.event_type === 'Killed').length
    const botKills    = visible.filter(e => e.event_type === 'BotKill').length
    const botDeaths   = visible.filter(e => e.event_type === 'BotKilled' && !e.is_bot).length
    const stormDeaths = visible.filter(e => e.event_type === 'KilledByStorm').length
    const loots       = visible.filter(e => e.event_type === 'Loot').length
    const humans      = new Set(visible.filter(e => !e.is_bot).map(e => e.user_id)).size
    const bots        = new Set(visible.filter(e => e.is_bot).map(e => e.user_id)).size
    const totalDeaths = pvpDeaths + botDeaths + stormDeaths
    const kdr = totalDeaths > 0 ? ((kills + botKills) / totalDeaths).toFixed(2) : '—'
    return { kills, pvpDeaths, botKills, botDeaths, stormDeaths, loots, humans, bots, kdr }
  }, [events, selectedRegion, currentTime])

  const eventCounts = useMemo<Record<string, number>>(() => ({
    Kill: stats.kills,
    Killed: stats.pvpDeaths,
    BotKill: stats.botKills,
    BotKilled: stats.botDeaths,
    KilledByStorm: stats.stormDeaths,
    Loot: stats.loots,
  }), [stats])

  const [customKPIs, setCustomKPIs] = useState<CustomKPI[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/kpis', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then(setCustomKPIs)
        .catch(() => {})
    })
  }, [refreshKey])

  const maxKills  = Math.max(stats.kills, stats.botKills, 1)
  const maxDeaths = Math.max(stats.pvpDeaths, stats.botDeaths, stats.stormDeaths, 1)

  return (
    <aside className="w-52 bg-gray-950 border-l border-gray-800 flex flex-col overflow-y-auto shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full bg-blue-500 inline-block" />
        <h2 className="text-white text-xs font-bold uppercase tracking-widest">
          {selectedRegion ? 'Region Stats' : 'Match Stats'}
        </h2>
      </div>

      <div className="p-4 space-y-5 flex-1">

        {/* MH as killer */}
        <div>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">MH Kills</p>
          <StatBar label="MH × H" value={stats.kills}    max={maxKills} color="#EF4444" dot="#EF4444" tooltip="Main Human kills a Human" />
          <StatBar label="MH × B" value={stats.botKills} max={maxKills} color="#F97316" dot="#F97316" tooltip="Main Human kills a Bot" />
        </div>

        <div className="h-px bg-gray-800" />

        {/* MH as victim */}
        <div>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">MH Deaths</p>
          <StatBar label="H × MH"     value={stats.pvpDeaths}   max={maxDeaths} color="#991B1B" dot="#EF4444" tooltip="Human kills Main Human" />
          <StatBar label="B × MH"     value={stats.botDeaths}   max={maxDeaths} color="#7C3AED" dot="#A855F7" tooltip="Bot kills Main Human" />
          <StatBar label="Storm × MH" value={stats.stormDeaths} max={maxDeaths} color="#5B21B6" dot="#A78BFA" tooltip="Storm kills Main Human" />
        </div>

        <div className="h-px bg-gray-800" />

        {/* Loot */}
        <StatBar label="Loots" value={stats.loots} max={Math.max(stats.loots, 1)} color="#B45309" dot="#FCD34D" />

        <div className="h-px bg-gray-800" />

        {/* K/D */}
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">K/D Ratio</span>
          <span className="text-blue-400 text-lg font-bold tabular-nums">{stats.kdr}</span>
        </div>

        <div className="h-px bg-gray-800" />

        {/* Players */}
        <div className="grid grid-cols-2 gap-2">
          <PlayerChip label="Humans" value={stats.humans} color="#3B82F6" />
          <PlayerChip label="Bots"   value={stats.bots}   color="#6B7280" />
        </div>

        {/* Custom KPIs */}
        {customKPIs.length > 0 && (
          <>
            <div className="h-px bg-gray-800" />
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">Custom KPIs</p>
              {customKPIs.map(kpi => {
                const value = evalKPI(kpi.formula, eventCounts)
                return (
                  <div key={kpi.id} className="mb-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: kpi.color }} />
                        <span className="text-gray-400 text-xs truncate max-w-24">{kpi.name}</span>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${value === '—' ? 'text-gray-600' : 'text-white'}`}>
                        {value}
                      </span>
                    </div>
                    {kpi.description && (
                      <p className="text-gray-700 text-[10px] ml-3.5 truncate">{kpi.description}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
    </aside>
  )
}

function StatBar({ label, value, max, color, dot, tooltip }: {
  label: string; value: number; max: number; color: string; dot: string; tooltip?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="mb-2.5 group relative">
      {tooltip && (
        <div className="absolute left-0 -top-7 bg-gray-800 border border-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {tooltip}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
          <span className="text-gray-400 text-xs">{label}</span>
        </div>
        <span className="text-white text-xs font-bold tabular-nums">{value}</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function PlayerChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-center">
      <div className="text-lg font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-gray-600 text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  )
}
