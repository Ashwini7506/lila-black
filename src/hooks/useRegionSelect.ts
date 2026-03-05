import { useState, useCallback, useRef, useEffect } from 'react'
import { Region } from '@/types'

export function useRegionSelect() {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [draftRegion, setDraftRegion] = useState<Region | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const startPoint = useRef<{ x: number; y: number } | null>(null)

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = 1024 / rect.width
    const scaleY = 1024 / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedRegion(null)
        setDraftRegion(null)
        setIsSelecting(false)
        startPoint.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!e.shiftKey) {
      // Plain click — clear any existing selection
      setSelectedRegion(null)
      return
    }
    e.preventDefault()
    const pt = getCanvasCoords(e)
    startPoint.current = pt
    setIsSelecting(true)
    setDraftRegion(null)
    setSelectedRegion(null)
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPoint.current) return
    const pt = getCanvasCoords(e)
    setDraftRegion({ x1: startPoint.current.x, y1: startPoint.current.y, x2: pt.x, y2: pt.y })
  }, [isSelecting])

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPoint.current) return
    const pt = getCanvasCoords(e)
    const region = { x1: startPoint.current.x, y1: startPoint.current.y, x2: pt.x, y2: pt.y }
    if (Math.abs(region.x2 - region.x1) > 20 && Math.abs(region.y2 - region.y1) > 20) {
      setSelectedRegion(region)
    }
    setIsSelecting(false)
    setDraftRegion(null)
    startPoint.current = null
  }, [isSelecting])

  return {
    selectedRegion,
    draftRegion,
    isSelecting,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    clearRegion: () => setSelectedRegion(null),
    setRegion: (r: Region) => setSelectedRegion(r),
  }
}
