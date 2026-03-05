import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

const GRID_SIZE = 32 // 32x32 grid over 1024px canvas = 32px per cell

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const match_id = searchParams.get('match_id')
  const event_types = searchParams.get('event_types')?.split(',') ?? ['Kill', 'Killed']

  if (!match_id) {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('events')
    .select('pixel_x, pixel_y')
    .eq('match_id', match_id)
    .in('event_type', event_types)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate into grid cells
  const cellSize = 1024 / GRID_SIZE
  const grid: Record<string, number> = {}

  for (const event of data ?? []) {
    const col = Math.floor(event.pixel_x / cellSize)
    const row = Math.floor(event.pixel_y / cellSize)
    const key = `${col},${row}`
    grid[key] = (grid[key] ?? 0) + 1
  }

  const cells = Object.entries(grid).map(([key, count]) => {
    const [col, row] = key.split(',').map(Number)
    return {
      pixel_x: col * cellSize + cellSize / 2,
      pixel_y: row * cellSize + cellSize / 2,
      count,
    }
  })

  return NextResponse.json(cells)
}
