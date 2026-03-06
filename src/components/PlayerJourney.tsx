'use client'
import { useMemo } from 'react'
import { PlayerEvent, Match } from '@/types'

interface Props {
  matchId: string
  userId: string
  isBot: boolean
  label: string
  events: PlayerEvent[]
  matches: Match[]
  watchingTimeline: boolean
  onWatchTimeline: () => void
  onClose: () => void
}

const EVENT_META: Record<string, { icon: string; color: string; text: string }> = {
  Kill:          { icon: '●', color: '#EF4444', text: 'Killed a player' },
  Killed:        { icon: '✕', color: '#EF4444', text: 'Killed by player' },
  BotKill:       { icon: '●', color: '#F97316', text: 'Killed a bot' },
  BotKilled:     { icon: '✕', color: '#A855F7', text: 'Killed by bot' },
  KilledByStorm: { icon: '⚡', color: '#A78BFA', text: 'Killed by storm' },
  Loot:          { icon: '★', color: '#FCD34D', text: 'Looted' },
}

function fmtTime(ts: number, base: number) {
  const s = Math.round(ts - base)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function PlayerJourney({ matchId, userId, isBot, label, events, matches, watchingTimeline, onWatchTimeline, onClose }: Props) {
  const match = matches.find(m => m.match_id === matchId)

  const entityEvents = useMemo(() => {
    return events
      .filter(e => e.match_id === matchId && e.user_id === userId)
      .sort((a, b) => a.ts - b.ts)
  }, [events, matchId, userId])

  const positionEvents = entityEvents.filter(e =>
    e.event_type === 'Position' || e.event_type === 'BotPosition'
  )
  const actionEvents = entityEvents.filter(e =>
    e.event_type !== 'Position' && e.event_type !== 'BotPosition'
  )

  const baseTs = entityEvents[0]?.ts ?? 0
  const lastTs = entityEvents[entityEvents.length - 1]?.ts ?? baseTs
  const survivalSec = Math.round(lastTs - baseTs)
  const survivalStr = `${Math.floor(survivalSec / 60)}m ${survivalSec % 60}s`

  const kills     = entityEvents.filter(e => e.event_type === 'Kill' || e.event_type === 'BotKill').length
  const deaths    = entityEvents.filter(e => e.event_type === 'Killed' || e.event_type === 'BotKilled' || e.event_type === 'KilledByStorm').length
  const loots     = entityEvents.filter(e => e.event_type === 'Loot').length

  // Rough path distance in pixel units
  const dist = useMemo(() => {
    let d = 0
    for (let i = 1; i < positionEvents.length; i++) {
      const dx = positionEvents[i].pixel_x - positionEvents[i - 1].pixel_x
      const dy = positionEvents[i].pixel_y - positionEvents[i - 1].pixel_y
      d += Math.sqrt(dx * dx + dy * dy)
    }
    return Math.round(d)
  }, [positionEvents])

  const accentColor = isBot ? '#F97316' : '#60A5FA'

  return (
    <div className="w-64 bg-gray-950 border-l border-gray-800 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <span className="text-base leading-none">{isBot ? '🤖' : '👤'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">{label}</div>
          {match && (
            <div className="text-[10px] text-gray-500">
              {match.human_count}H · {match.bot_count}B · {match.total_events?.toLocaleString()} events
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white text-xs shrink-0">✕</button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 border-b border-gray-800 shrink-0">
        {[
          { label: 'Kills',    value: kills,      color: '#EF4444' },
          { label: 'Deaths',   value: deaths,     color: '#A855F7' },
          { label: 'Loots',    value: loots,      color: '#FCD34D' },
          { label: 'Survived', value: survivalStr, color: accentColor },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center py-2 border-r border-gray-800 last:border-r-0">
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
            <span className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* Path stat */}
      <div className="px-3 py-1.5 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-500">Path distance</span>
        <span className="text-[10px] font-mono text-gray-300 ml-auto">{dist.toLocaleString()} px</span>
      </div>

      {/* Watch on timeline */}
      <div className="px-3 py-2 border-b border-gray-800 shrink-0">
        <button
          onClick={onWatchTimeline}
          className={`w-full text-[11px] font-medium py-1.5 rounded-lg border transition-colors ${
            watchingTimeline
              ? 'bg-blue-600/20 border-blue-600/50 text-blue-300'
              : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-blue-700 hover:text-blue-300'
          }`}
        >
          {watchingTimeline ? '⏹ Watching journey' : '▶ Watch journey on timeline'}
        </button>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto">
        {actionEvents.length === 0 ? (
          <p className="text-[11px] text-gray-600 px-3 py-4 text-center">No combat or loot events</p>
        ) : (
          <div className="py-1">
            {actionEvents.map((e, i) => {
              const meta = EVENT_META[e.event_type]
              if (!meta) return null
              return (
                <div key={i} className="flex items-start gap-2 px-3 py-1.5 hover:bg-gray-900/50 transition-colors">
                  <span className="text-[11px] mt-0.5 shrink-0" style={{ color: meta.color }}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-gray-300">{meta.text}</div>
                    <div className="text-[10px] text-gray-600 font-mono">
                      T+{fmtTime(e.ts, baseTs)}
                      <span className="ml-2 text-gray-700">
                        ({Math.round(e.pixel_x)}, {Math.round(e.pixel_y)})
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-800 shrink-0">
        <p className="text-[9px] text-gray-700 text-center">
          {positionEvents.length} position points · {actionEvents.length} actions
        </p>
      </div>
    </div>
  )
}
