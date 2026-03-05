import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { AIAnnotation, MapId } from '@/types'

const CANVAS = 1024

// ── Grid helpers ─────────────────────────────────────────────────────────────

function buildGrid(events: { pixel_x: number; pixel_y: number }[], gridSize: number): number[][] {
  const cell = CANVAS / gridSize
  const grid: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0))
  for (const e of events) {
    const gx = Math.min(gridSize - 1, Math.floor(e.pixel_x / cell))
    const gy = Math.min(gridSize - 1, Math.floor(e.pixel_y / cell))
    grid[gy][gx]++
  }
  return grid
}

// BFS connected components on boolean grid
function connectedComponents(mask: boolean[][], rows: number, cols: number) {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
  const components: { gx: number; gy: number }[][] = []
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (!mask[gy][gx] || visited[gy][gx]) continue
      const comp: { gx: number; gy: number }[] = []
      const queue = [{ gx, gy }]
      visited[gy][gx] = true
      while (queue.length) {
        const { gx: cx, gy: cy } = queue.shift()!
        comp.push({ gx: cx, gy: cy })
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nx = cx + dx, ny = cy + dy
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && mask[ny][nx] && !visited[ny][nx]) {
            visited[ny][nx] = true
            queue.push({ gx: nx, gy: ny })
          }
        }
      }
      components.push(comp)
    }
  }
  return components
}

function centroid(cells: { gx: number; gy: number }[], cellSize: number) {
  const cx = cells.reduce((s, c) => s + c.gx, 0) / cells.length
  const cy = cells.reduce((s, c) => s + c.gy, 0) / cells.length
  return {
    center_px: (cx + 0.5) * cellSize,
    center_py: (cy + 0.5) * cellSize,
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { matchIds, mapId } = await req.json() as { matchIds: string[]; mapId: MapId }

  if (!matchIds?.length || !mapId) {
    return NextResponse.json({ error: 'matchIds and mapId required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: events, error } = await admin
    .from('events')
    .select('pixel_x, pixel_y, event_type')
    .in('match_id', matchIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!events || events.length === 0) return NextResponse.json([])

  const annotations: AIAnnotation[] = []
  const matchCount = matchIds.length
  let idSeq = 0

  // ── Dead zones (8×8 grid) ─────────────────────────────────────────────────
  const DEAD_GRID = 8
  const DEAD_CELL = CANVAS / DEAD_GRID
  const deadGrid = buildGrid(events, DEAD_GRID)
  const maxCount = Math.max(...deadGrid.flat(), 1)
  const deadThreshold = maxCount * 0.015   // < 1.5% of peak density

  const deadMask = deadGrid.map(row => row.map(c => c <= deadThreshold))
  const deadComponents = connectedComponents(deadMask, DEAD_GRID, DEAD_GRID)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)

  for (const comp of deadComponents) {
    if (comp.length < 2) continue  // skip tiny single-cell zones
    const { center_px, center_py } = centroid(comp, DEAD_CELL)
    const radius = Math.max(55, Math.sqrt(comp.length) * DEAD_CELL * 0.55)
    const actualCount = events.filter(e => {
      const gx = Math.min(DEAD_GRID - 1, Math.floor(e.pixel_x / DEAD_CELL))
      const gy = Math.min(DEAD_GRID - 1, Math.floor(e.pixel_y / DEAD_CELL))
      return comp.some(c => c.gx === gx && c.gy === gy)
    }).length

    annotations.push({
      id: `dz-${idSeq++}`,
      center_px,
      center_py,
      radius,
      label: `Dead zone — ${actualCount} events`,
      description: `Across ${matchCount} match${matchCount > 1 ? 'es' : ''}, this area recorded only ${actualCount} event${actualCount !== 1 ? 's' : ''} (${comp.length} grid cell${comp.length > 1 ? 's' : ''}). Players are not routing through here. Possible causes: inaccessible terrain, poor loot density, no strategic value, or excessive bot dominance pushing players away. Consider adding cover, loot incentives, or adjusting spawn paths to draw traffic.`,
      category: 'dead_zone',
      color: '#3B82F6',
    })
  }

  // ── Choke points (16×16 kill grid) ───────────────────────────────────────
  const KILL_GRID = 16
  const KILL_CELL = CANVAS / KILL_GRID
  const killEvents = events.filter(e =>
    e.event_type === 'Kill' || e.event_type === 'Killed' ||
    e.event_type === 'BotKill' || e.event_type === 'BotKilled'
  )
  if (killEvents.length > 0) {
    const killGrid = buildGrid(killEvents, KILL_GRID)
    const totalKills = killEvents.length

    // Find top cells, then merge adjacent ones
    const flatCells = []
    for (let gy = 0; gy < KILL_GRID; gy++) {
      for (let gx = 0; gx < KILL_GRID; gx++) {
        if (killGrid[gy][gx] > 0) flatCells.push({ gx, gy, count: killGrid[gy][gx] })
      }
    }
    flatCells.sort((a, b) => b.count - a.count)

    // Take top 2 non-overlapping cells (min 3 cells apart)
    const chosen: typeof flatCells = []
    for (const cell of flatCells) {
      if (chosen.every(c => Math.abs(c.gx - cell.gx) > 2 || Math.abs(c.gy - cell.gy) > 2)) {
        chosen.push(cell)
        if (chosen.length >= 2) break
      }
    }

    for (const cell of chosen) {
      const pct = Math.round((cell.count / totalKills) * 100)
      if (pct < 8) continue   // skip if less than 8% of all kills — not a real choke
      annotations.push({
        id: `cp-${idSeq++}`,
        center_px: (cell.gx + 0.5) * KILL_CELL,
        center_py: (cell.gy + 0.5) * KILL_CELL,
        radius: 60,
        label: `${cell.count} kills (${pct}%)`,
        description: `This ${KILL_CELL}×${KILL_CELL}px zone accounts for ${pct}% of all combat events across ${matchCount} match${matchCount > 1 ? 'es' : ''} (${cell.count} kill/death events). This level of concentration suggests a choke point — players are forced through a narrow path or the geometry creates unavoidable line-of-sight. Consider widening the area, adding flanking routes, or rebalancing bot placement here.`,
        category: 'choke_point',
        color: '#F97316',
      })
    }
  }

  // ── Storm clusters ────────────────────────────────────────────────────────
  const stormEvents = events.filter(e => e.event_type === 'KilledByStorm')
  if (stormEvents.length >= 5) {
    const STORM_GRID = 8
    const STORM_CELL = CANVAS / STORM_GRID
    const stormGrid = buildGrid(stormEvents, STORM_GRID)
    const flatStorm = []
    for (let gy = 0; gy < STORM_GRID; gy++) {
      for (let gx = 0; gx < STORM_GRID; gx++) {
        if (stormGrid[gy][gx] > 0) flatStorm.push({ gx, gy, count: stormGrid[gy][gx] })
      }
    }
    flatStorm.sort((a, b) => b.count - a.count)
    const top = flatStorm[0]
    if (top && top.count >= 3) {
      annotations.push({
        id: `sc-${idSeq++}`,
        center_px: (top.gx + 0.5) * STORM_CELL,
        center_py: (top.gy + 0.5) * STORM_CELL,
        radius: 65,
        label: `${top.count} storm deaths`,
        description: `${top.count} storm-related deaths cluster in this zone across ${matchCount} match${matchCount > 1 ? 'es' : ''}. This suggests the storm circle frequently contracts through this area, or the safe zone boundary is difficult to escape. Players may be getting caught here repeatedly. Check if this is a dead end, a slow-movement corridor, or an area with insufficient cover to retreat safely.`,
        category: 'storm_cluster',
        color: '#A78BFA',
      })
    }
  }

  return NextResponse.json(annotations)
}
