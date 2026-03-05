'use client'
import { Insight } from '@/types'

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  frustration_zone: { label: 'Frustration Zone', icon: '⚠',  color: 'text-red-400 border-red-800 bg-red-900/20' },
  dead_zone:        { label: 'Dead Zone',         icon: '○',  color: 'text-gray-400 border-gray-700 bg-gray-800/20' },
  choke_point:      { label: 'Choke Point',       icon: '⬡',  color: 'text-orange-400 border-orange-800 bg-orange-900/20' },
  hot_drop:         { label: 'Hot Drop',          icon: '🎯', color: 'text-yellow-400 border-yellow-800 bg-yellow-900/20' },
  storm_cluster:    { label: 'Storm Cluster',     icon: '⚡',  color: 'text-violet-400 border-violet-800 bg-violet-900/20' },
  loot_black_hole:  { label: 'Loot Black Hole',  icon: '◈',  color: 'text-emerald-400 border-emerald-800 bg-emerald-900/20' },
  combat_hotspot:   { label: 'Combat Hotspot',   icon: '⚔',  color: 'text-pink-400 border-pink-800 bg-pink-900/20' },
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

interface Props {
  insights: Insight[]
}

export default function InsightsOverlay({ insights }: Props) {
  const high = insights
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 10)

  if (high.length === 0) return (
    <div className="p-4 text-gray-600 text-xs">No insights for this map yet.</div>
  )

  return (
    <div className="p-3 space-y-2 overflow-y-auto">
      {high.map((ins, i) => {
        const meta = TYPE_LABELS[ins.type] ?? { label: ins.type, icon: '•', color: 'text-gray-400 border-gray-700 bg-gray-800/20' }
        return (
          <div key={i} className={`border rounded p-2 ${meta.color}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs">{meta.icon}</span>
              <span className="text-xs font-semibold">{meta.label}</span>
              <span className={`ml-auto text-xs px-1 rounded ${
                ins.severity === 'high' ? 'bg-red-800 text-red-200' : 'bg-gray-700 text-gray-300'
              }`}>{ins.severity}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{ins.description}</p>
          </div>
        )
      })}
    </div>
  )
}
