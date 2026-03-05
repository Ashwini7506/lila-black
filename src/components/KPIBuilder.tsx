'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/utils/supabase'
import { CustomKPI } from '@/types'

const FORMULA_VARS = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']
const COLORS = ['#60A5FA', '#34D399', '#F97316', '#A78BFA', '#F43F5E', '#FBBF24', '#22D3EE']
const SAMPLE_COUNTS: Record<string, number> = { Kill: 5, Killed: 3, BotKill: 8, BotKilled: 2, KilledByStorm: 1, Loot: 20 }

function evalFormula(formula: string): string {
  try {
    const argNames = FORMULA_VARS
    const argValues = FORMULA_VARS.map(v => SAMPLE_COUNTS[v])
    // eslint-disable-next-line no-new-func
    const result = new Function(...argNames, 'return ' + formula)(...argValues)
    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) return '—'
    return result.toFixed(3).replace(/\.?0+$/, '')
  } catch {
    return '—'
  }
}

interface Props {
  onClose: () => void
  onKPIsChanged: () => void
}

export default function KPIBuilder({ onClose, onKPIsChanged }: Props) {
  const [kpis, setKpis] = useState<CustomKPI[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formula, setFormula] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchKPIs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/kpis', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) setKpis(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchKPIs() }, [fetchKPIs])

  const handleSave = async () => {
    if (!name.trim() || !formula.trim()) return
    setSaving(true)
    setSaveError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaveError('Not authenticated'); setSaving(false); return }

    const res = await fetch('/api/kpis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, formula: formula.trim(), color }),
    })

    if (res.ok) {
      const kpi = await res.json()
      setKpis(prev => [...prev, kpi])
      setName('')
      setDescription('')
      setFormula('')
      setColor(COLORS[0])
      onKPIsChanged()
    } else {
      const j = await res.json()
      setSaveError(j.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/kpis/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      setKpis(prev => prev.filter(k => k.id !== id))
      onKPIsChanged()
    }
  }

  const preview = formula.trim() ? evalFormula(formula) : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      <div className="pointer-events-auto h-full w-80 bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <h2 className="text-white text-xs font-bold uppercase tracking-wider">KPI Builder</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-sm transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Formula variables reference */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">Variables</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMULA_VARS.map(v => (
                <button
                  key={v}
                  onClick={() => setFormula(f => f + (f && !f.endsWith(' ') ? ' ' : '') + v)}
                  className="text-[10px] font-mono px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-blue-300 hover:bg-gray-700 hover:border-blue-600 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-gray-600 text-[10px] uppercase tracking-widest block mb-1.5">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. K/D Ratio"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Formula + live preview */}
          <div>
            <label className="text-gray-600 text-[10px] uppercase tracking-widest block mb-1.5">Formula *</label>
            <input
              value={formula}
              onChange={e => setFormula(e.target.value)}
              placeholder="Kill / (Kill + Killed)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-700 focus:outline-none focus:border-blue-600"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-gray-600 text-[10px]">Preview (sample data):</span>
              <span className={`text-sm font-bold tabular-nums ${preview === '—' ? 'text-gray-600' : 'text-blue-400'}`}>
                {preview}
              </span>
            </div>
            <p className="text-gray-700 text-[10px] mt-1">
              Sample: Kill=5, Killed=3, BotKill=8, BotKilled=2, KilledByStorm=1, Loot=20
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-600 text-[10px] uppercase tracking-widest block mb-1.5">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-gray-600 text-[10px] uppercase tracking-widest block mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {saveError && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">{saveError}</p>
          )}

          <button
            onClick={handleSave}
            disabled={!name.trim() || !formula.trim() || saving}
            className="w-full px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save KPI'}
          </button>

          {/* Saved KPIs list */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-2">Saved KPIs</p>
            {loading ? (
              <p className="text-gray-700 text-xs">Loading…</p>
            ) : kpis.length === 0 ? (
              <p className="text-gray-700 text-xs italic">No custom KPIs yet</p>
            ) : (
              <div className="space-y-2">
                {kpis.map(kpi => (
                  <div key={kpi.id} className="flex items-start gap-2 bg-gray-950 border border-gray-800 rounded-lg p-3">
                    <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: kpi.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{kpi.name}</p>
                      <p className="text-gray-600 text-[10px] font-mono mt-0.5 truncate">{kpi.formula}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(kpi.id)}
                      className="text-gray-700 hover:text-red-400 text-xs transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
