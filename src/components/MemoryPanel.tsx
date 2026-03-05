'use client'
import { useState, useEffect, useCallback } from 'react'
import { DesignerMemory, MapId } from '@/types'

interface Props {
  designerId: string
  mapId: MapId | null
  onClose: () => void
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  chat:       { label: 'Chat',       color: 'text-blue-400 bg-blue-950/60' },
  annotation: { label: 'Annotation', color: 'text-purple-400 bg-purple-950/60' },
  manual:     { label: 'Note',       color: 'text-green-400 bg-green-950/60' },
}

export default function MemoryPanel({ designerId, mapId, onClose }: Props) {
  const [memories, setMemories] = useState<DesignerMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ designerId })
      if (mapId) params.set('mapId', mapId)
      const res = await fetch(`/api/memory?${params}`)
      if (res.ok) setMemories(await res.json())
    } finally {
      setLoading(false)
    }
  }, [designerId, mapId])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/memory/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designerId }),
      })
      setMemories(prev => prev.filter(m => m.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designerId, mapId, content: note.trim(), source: 'manual' }),
      })
      if (res.ok) {
        const saved = await res.json()
        setMemories(prev => [saved, ...prev])
        setNote('')
      }
    } finally {
      setSaving(false)
    }
  }

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-900 border-l border-gray-700 flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="h-11 px-4 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-sm">◈</span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">AI Memory</span>
          {mapId && <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{mapId}</span>}
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white text-sm transition-colors">✕</button>
      </div>

      {/* Note input */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">Add a manual note</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. North corridor is always empty — players avoid it after patch 2.1"
          rows={2}
          className="w-full bg-gray-800 text-white text-xs px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-purple-500 placeholder-gray-600 resize-none"
        />
        <button
          onClick={handleSaveNote}
          disabled={saving || !note.trim()}
          className="mt-1.5 w-full text-xs py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {loading ? (
          <p className="text-xs text-gray-600 animate-pulse pt-4 text-center">Loading memories...</p>
        ) : memories.length === 0 ? (
          <p className="text-xs text-gray-600 pt-4 text-center">No memories yet. AI will remember significant findings automatically.</p>
        ) : (
          memories.map(m => {
            const src = SOURCE_LABELS[m.source] ?? SOURCE_LABELS.chat
            return (
              <div key={m.id} className="bg-gray-800/60 rounded-lg p-3 group relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${src.color}`}>{src.label}</span>
                  <span className="text-[10px] text-gray-600">{fmt(m.created_at)}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{m.content}</p>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-all disabled:opacity-40"
                  title="Delete memory"
                >
                  {deletingId === m.id ? '...' : '✕'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
