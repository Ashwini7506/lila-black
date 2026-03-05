import { useState, useEffect, useRef, useCallback } from 'react'
import { PlayerEvent } from '@/types'

export function usePlayback(events: PlayerEvent[]) {
  const minTime = events.length > 0 ? Math.min(...events.map(e => e.ts)) : 0
  const maxTime = events.length > 0 ? Math.max(...events.map(e => e.ts)) : 0

  const [currentTime, setCurrentTime] = useState(maxTime)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const animRef = useRef<number | undefined>(undefined)
  const lastTsRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setCurrentTime(maxTime)
    setIsPlaying(false)
  }, [minTime, maxTime])

  const tick = useCallback((timestamp: number) => {
    if (!lastTsRef.current) lastTsRef.current = timestamp
    const delta = timestamp - lastTsRef.current
    lastTsRef.current = timestamp

    setCurrentTime(prev => {
      const next = prev + (delta / 1000) * speed
      if (next >= maxTime) { setIsPlaying(false); return maxTime }
      return next
    })
    animRef.current = requestAnimationFrame(tick)
  }, [speed, maxTime])

  useEffect(() => {
    if (isPlaying) {
      lastTsRef.current = undefined
      animRef.current = requestAnimationFrame(tick)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [isPlaying, tick])

  return {
    currentTime,
    isPlaying,
    speed,
    minTime,
    maxTime,
    duration: maxTime - minTime,
    togglePlay: () => {
      if (!isPlaying && currentTime >= maxTime) setCurrentTime(minTime)
      setIsPlaying(p => !p)
    },
    seek: (t: number) => setCurrentTime(t),
    setSpeed,
  }
}
