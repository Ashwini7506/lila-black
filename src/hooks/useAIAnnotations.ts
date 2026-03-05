import { useState, useEffect, useRef } from 'react'
import { AIAnnotation, MapId } from '@/types'

export function useAIAnnotations(matchIds: string[], mapId: MapId) {
  const [annotations, setAnnotations] = useState<AIAnnotation[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (matchIds.length === 0) {
      setAnnotations([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/ai-annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchIds, mapId }),
        })
        if (res.ok) setAnnotations(await res.json())
      } catch {
        // silently fail — annotations are non-critical
      } finally {
        setLoading(false)
      }
    }, 900)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [matchIds.join(','), mapId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { annotations, loading }
}
