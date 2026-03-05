import { useState, useEffect } from 'react'
import { PlayerEvent, Match, MapId } from '@/types'

export function useMatchData(matchIds: string[]) {
  const [events, setEvents] = useState<PlayerEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const key = matchIds.join(',')

  useEffect(() => {
    if (matchIds.length === 0) { setEvents([]); return }
    setLoading(true)
    setError(null)
    fetch(`/api/events?match_ids=${key}`)
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [key])

  return { events, loading, error }
}

export function useMatches(mapId: MapId | null, dateLabel: string | null) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mapId) { setMatches([]); return }
    setLoading(true)
    const params = new URLSearchParams()
    if (mapId) params.set('map_id', mapId)
    if (dateLabel) params.set('date', dateLabel)
    fetch(`/api/matches?${params}`)
      .then(r => r.json())
      .then(data => { setMatches(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mapId, dateLabel])

  return { matches, loading }
}
