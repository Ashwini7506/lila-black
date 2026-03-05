import { supabaseAdmin } from './supabase'
import { Region, MapId } from '@/types'

// ── Helper ────────────────────────────────────────────────────────────────────

function applyRegionFilter(
  query: any,
  region: Region | null
) {
  if (!region) return query
  return query
    .gte('pixel_x', Math.min(region.x1, region.x2))
    .lte('pixel_x', Math.max(region.x1, region.x2))
    .gte('pixel_y', Math.min(region.y1, region.y2))
    .lte('pixel_y', Math.max(region.y1, region.y2))
}

function inRegion(e: { pixel_x: number; pixel_y: number }, region: Region) {
  return (
    e.pixel_x >= Math.min(region.x1, region.x2) &&
    e.pixel_x <= Math.max(region.x1, region.x2) &&
    e.pixel_y >= Math.min(region.y1, region.y2) &&
    e.pixel_y <= Math.max(region.y1, region.y2)
  )
}

// ── Tool 1: query_events ──────────────────────────────────────────────────────
// Raw event rows — AI reasons over them directly (spawns, sequences, etc.)

export async function queryEvents(
  matchIds: string[],
  eventTypes: string[] | null,
  region: Region | null,
  sortBy: 'ts_asc' | 'ts_desc' | null,
  limit: number
) {
  const admin = supabaseAdmin()
  let query = admin
    .from('events')
    .select('event_type, pixel_x, pixel_y, ts, user_id, is_bot, match_id')
    .in('match_id', matchIds)

  if (eventTypes && eventTypes.length > 0) query = query.in('event_type', eventTypes)
  query = applyRegionFilter(query, region)
  if (sortBy === 'ts_asc')  query = (query as any).order('ts', { ascending: true })
  if (sortBy === 'ts_desc') query = (query as any).order('ts', { ascending: false })

  const cap = Math.min(limit || 200, 300)
  const { data } = await (query as any).limit(cap)
  return {
    count: data?.length ?? 0,
    truncated: (data?.length ?? 0) === cap,
    events: data ?? [],
    note: 'ts = unix timestamp. First Position event per (match_id, user_id) = that player\'s spawn point.',
  }
}

// ── Tool 2: aggregate_events ──────────────────────────────────────────────────
// Grouped/counted data — AI picks the grouping it needs

export async function aggregateEvents(
  matchIds: string[],
  eventTypes: string[] | null,
  region: Region | null,
  groupBy: string,
  mapId: MapId
) {
  const admin = supabaseAdmin()

  // For first_per_user: fetch ALL position events then filter spawns to region
  const needsGlobalFetch = groupBy === 'first_per_user'

  let query = admin
    .from('events')
    .select('event_type, pixel_x, pixel_y, ts, user_id, is_bot, match_id')
    .in('match_id', matchIds)

  if (eventTypes && eventTypes.length > 0) query = query.in('event_type', eventTypes)
  if (!needsGlobalFetch) query = applyRegionFilter(query, region)

  const { data } = await (query as any).limit(5000)
  const events = data ?? []

  switch (groupBy) {

    case 'event_type': {
      const counts: Record<string, number> = {}
      for (const e of events) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
      return { total: events.length, by_event_type: counts }
    }

    case 'user_id': {
      const humans = new Set<string>()
      const bots   = new Set<string>()
      for (const e of events) {
        if (e.is_bot) bots.add(e.user_id)
        else humans.add(e.user_id)
      }
      return { total_events: events.length, unique_humans: humans.size, unique_bots: bots.size }
    }

    case 'match_id': {
      const byMatch: Record<string, { total: number; humans: Set<string>; bots: Set<string> }> = {}
      for (const e of events) {
        if (!byMatch[e.match_id]) byMatch[e.match_id] = { total: 0, humans: new Set(), bots: new Set() }
        byMatch[e.match_id].total++
        if (e.is_bot) byMatch[e.match_id].bots.add(e.user_id)
        else byMatch[e.match_id].humans.add(e.user_id)
      }
      return {
        total_events: events.length,
        matches: Object.entries(byMatch).map(([match_id, v]) => ({
          match_id, total_events: v.total,
          unique_humans: v.humans.size, unique_bots: v.bots.size,
        })),
      }
    }

    case 'is_bot': {
      return {
        total: events.length,
        human_events: events.filter((e: any) => !e.is_bot).length,
        bot_events:   events.filter((e: any) =>  e.is_bot).length,
      }
    }

    // Spawn analysis: fetch first Position event per match in parallel, then filter to region
    case 'first_per_user': {
      const admin2 = supabaseAdmin()
      // Fetch earliest 50 position events per match in parallel (batched to avoid too many connections)
      const BATCH = 20
      const allSpawns: { user_id: string; match_id: string; pixel_x: number; pixel_y: number; is_bot: boolean }[] = []

      for (let i = 0; i < matchIds.length; i += BATCH) {
        const batch = matchIds.slice(i, i + BATCH)
        const results = await Promise.all(batch.map(mid =>
          admin2
            .from('events')
            .select('user_id, match_id, pixel_x, pixel_y, ts, is_bot')
            .eq('match_id', mid)
            .in('event_type', ['Position', 'BotPosition'])
            .order('ts', { ascending: true })
            .limit(50)
        ))
        for (const res of results) {
          const seen = new Set<string>()
          for (const e of res.data ?? []) {
            if (!seen.has(e.user_id)) { seen.add(e.user_id); allSpawns.push(e) }
          }
        }
      }

      const inR = region ? allSpawns.filter(s => inRegion(s, region)) : allSpawns

      // Per-match first spawn type (human or bot)
      const firstSpawnByMatch: Record<string, 'human' | 'bot'> = {}
      for (const s of inR) {
        if (!firstSpawnByMatch[s.match_id]) {
          firstSpawnByMatch[s.match_id] = s.is_bot ? 'bot' : 'human'
        }
      }
      const matchEntries = Object.values(firstSpawnByMatch)

      return {
        total_players_checked: allSpawns.length,
        spawns_in_region: inR.length,
        human_spawns: inR.filter(s => !s.is_bot).length,
        bot_spawns:   inR.filter(s =>  s.is_bot).length,
        matches_with_spawns_here: matchEntries.length,
        matches_first_spawn_was_human: matchEntries.filter(t => t === 'human').length,
        matches_first_spawn_was_bot:   matchEntries.filter(t => t === 'bot').length,
        note: 'Spawn point = first recorded Position/BotPosition event per player per match. "first spawn type" = whether the very first entity to spawn in this region per match was human or bot.',
      }
    }

    case 'grid_8x8':
    case 'grid_16x16': {
      const GRID = groupBy === 'grid_16x16' ? 16 : 8
      const CELL = 1024 / GRID
      const grid: number[][] = Array.from({ length: GRID }, () => Array(GRID).fill(0))
      for (const e of events) {
        const gx = Math.min(GRID - 1, Math.floor(e.pixel_x / CELL))
        const gy = Math.min(GRID - 1, Math.floor(e.pixel_y / CELL))
        grid[gy][gx]++
      }
      const { pixelToWorld } = await import('./coordinates')
      const cells = []
      for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
          const { x, z } = pixelToWorld((gx + 0.5) * CELL, (gy + 0.5) * CELL, mapId)
          cells.push({ gx, gy, count: grid[gy][gx], world_x: Math.round(x), world_z: Math.round(z) })
        }
      }
      return {
        total_events: events.length,
        grid_size: `${GRID}x${GRID}`,
        cells: cells.sort((a, b) => b.count - a.count),
      }
    }

    default:
      return {
        error: `Unknown group_by: "${groupBy}"`,
        valid_options: ['event_type', 'user_id', 'match_id', 'is_bot', 'first_per_user', 'grid_8x8', 'grid_16x16'],
      }
  }
}

// ── Tool 3: get_match_summary ─────────────────────────────────────────────────
// Match metadata — different table, always useful as baseline context

export async function getMatchSummary(matchIds: string[]) {
  const admin = supabaseAdmin()
  const { data } = await admin.from('matches').select('*').in('match_id', matchIds)
  return data ?? []
}

// ── Tool 4: compare_date_labels ───────────────────────────────────────────────
// Patch impact analysis — compares two time periods on the same map

export async function compareDateLabels(mapId: MapId, date1: string, date2: string) {
  const admin = supabaseAdmin()
  const [r1, r2] = await Promise.all([
    admin.from('matches').select('match_id, total_events, human_count, bot_count').eq('map_id', mapId).eq('date_label', date1),
    admin.from('matches').select('match_id, total_events, human_count, bot_count').eq('map_id', mapId).eq('date_label', date2),
  ])
  const summarize = (rows: typeof r1['data']) => {
    const m = rows ?? []
    const totalEvents = m.reduce((s, r) => s + (r.total_events ?? 0), 0)
    const totalHumans = m.reduce((s, r) => s + (r.human_count ?? 0), 0)
    return {
      matches: m.length,
      total_events: totalEvents,
      avg_events_per_match: m.length > 0 ? Math.round(totalEvents / m.length) : 0,
      avg_humans_per_match: m.length > 0 ? Math.round(totalHumans / m.length) : 0,
    }
  }
  return { [date1]: summarize(r1.data), [date2]: summarize(r2.data) }
}
