import { useState, useEffect } from 'react'
import { Insight, MapId } from '@/types'

export function useInsights(mapId: MapId | null) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mapId) { setInsights([]); return }
    setLoading(true)
    fetch(`/api/insights?map_id=${mapId}`)
      .then(r => r.json())
      .then(data => { setInsights(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mapId])

  return { insights, loading }
}
