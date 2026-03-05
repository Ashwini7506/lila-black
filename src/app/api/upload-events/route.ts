import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { MAP_CONFIGS } from '@/utils/coordinates'
import { MapId } from '@/types'

const BATCH_SIZE = 1000
const CANVAS = 1024

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function worldToPixelClamped(x: number, z: number, mapId: MapId) {
  const cfg = MAP_CONFIGS[mapId]
  if (!cfg) return null
  const pixel_x = clamp(((x - cfg.origin_x) / cfg.scale) * CANVAS, 0, CANVAS)
  const pixel_y = clamp((1 - (z - cfg.origin_z) / cfg.scale) * CANVAS, 0, CANVAS)
  return { pixel_x, pixel_y }
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
}

export async function POST(req: NextRequest) {
  const errors: string[] = []

  let csvText: string
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    csvText = await (file as File).text()
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 })
  }

  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV is empty or malformed' }, { status: 400 })
  }

  // Required columns
  const required = ['match_id', 'user_id', 'map_id', 'x', 'z', 'ts', 'event_type', 'is_bot', 'date_label']
  const firstRow = rows[0]
  const missing = required.filter(c => !(c in firstRow))
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing columns: ${missing.join(', ')}` }, { status: 400 })
  }

  const eventRows: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const mapId = r.map_id as MapId
    const x = parseFloat(r.x)
    const z = parseFloat(r.z)
    const ts = parseFloat(r.ts)

    if (!MAP_CONFIGS[mapId]) {
      errors.push(`Row ${i + 2}: unknown map_id "${r.map_id}"`)
      continue
    }
    if (isNaN(x) || isNaN(z) || isNaN(ts)) {
      errors.push(`Row ${i + 2}: invalid numeric fields`)
      continue
    }

    const px = worldToPixelClamped(x, z, mapId)!
    eventRows.push({
      match_id: r.match_id,
      user_id: r.user_id,
      map_id: mapId,
      x,
      z,
      ts,
      event_type: r.event_type,
      is_bot: r.is_bot === 'true' || r.is_bot === '1',
      date_label: r.date_label,
      pixel_x: px.pixel_x,
      pixel_y: px.pixel_y,
    })
  }

  const admin = supabaseAdmin()
  let inserted = 0

  // Batch insert events
  for (let i = 0; i < eventRows.length; i += BATCH_SIZE) {
    const batch = eventRows.slice(i, i + BATCH_SIZE)
    const { error } = await admin.from('events').insert(batch)
    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  // Aggregate matches from uploaded rows
  const matchMap = new Map<string, { map_id: MapId; date_label: string; human_ids: Set<string>; bot_ids: Set<string> }>()
  for (const r of eventRows) {
    const mid = r.match_id as string
    if (!matchMap.has(mid)) {
      matchMap.set(mid, {
        map_id: r.map_id as MapId,
        date_label: r.date_label as string,
        human_ids: new Set(),
        bot_ids: new Set(),
      })
    }
    const m = matchMap.get(mid)!
    if (r.is_bot) m.bot_ids.add(r.user_id as string)
    else m.human_ids.add(r.user_id as string)
  }

  // Count total events per match_id from DB (includes previously uploaded rows)
  let matchesUpdated = 0
  for (const [match_id, info] of matchMap.entries()) {
    const { count } = await admin
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', match_id)

    const { error } = await admin.from('matches').upsert({
      match_id,
      map_id: info.map_id,
      date_label: info.date_label,
      total_events: count ?? 0,
      human_count: info.human_ids.size,
      bot_count: info.bot_ids.size,
      map_match_number: 0,
    }, { onConflict: 'match_id' })

    if (error) {
      errors.push(`Match ${match_id}: ${error.message}`)
    } else {
      matchesUpdated++
    }
  }

  return NextResponse.json({ inserted, matchesUpdated, errors })
}
