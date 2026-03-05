'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/utils/supabase'

interface UploadResult {
  inserted: number
  matchesUpdated: number
  errors: string[]
}

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

export default function CSVUpload({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not authenticated'); setUploading(false); return }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload-events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
      } else {
        setResult(json)
        onSuccess?.()
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider">Upload Events CSV</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-sm transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Column reference */}
          <div className="bg-gray-950 rounded-lg p-3 text-[10px] font-mono text-gray-500 leading-relaxed">
            <p className="text-gray-400 mb-1">Expected columns:</p>
            match_id, user_id, map_id, x, z, ts, event_type, is_bot, date_label
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-blue-600 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null) }}
            />
            {file ? (
              <div>
                <p className="text-blue-400 text-sm font-medium">{file.name}</p>
                <p className="text-gray-600 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-sm">Click to select a CSV file</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/40 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-green-950/30 border border-green-800/50 rounded-lg p-3 space-y-1.5">
              <p className="text-green-400 text-xs font-bold">Upload complete</p>
              <div className="text-xs text-gray-400 space-y-0.5">
                <p><span className="text-white font-bold">{result.inserted}</span> events inserted</p>
                <p><span className="text-white font-bold">{result.matchesUpdated}</span> matches updated</p>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-0.5">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-red-400 text-[10px] font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-xs text-gray-500 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
