'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { PlayerEvent, Insight, Region, MapId, EventType, Match, AIAnnotation } from '@/types'
import { MAP_CONFIGS, pixelToWorld } from '@/utils/coordinates'

const CANVAS_SIZE = 1024

const PLAYER_COLORS = [
  '#60A5FA', '#34D399', '#F87171', '#FBBF24', '#A78BFA',
  '#F472B6', '#4ADE80', '#FB923C', '#38BDF8', '#E879F9',
]

const MATCH_COLORS = [
  '#60A5FA', '#34D399', '#F87171', '#FBBF24', '#A78BFA',
  '#F472B6', '#4ADE80', '#FB923C', '#38BDF8', '#E879F9',
  '#67E8F9', '#86EFAC', '#FCA5A5', '#FDE68A', '#C4B5FD',
]

interface Marker {
  cx: number
  cy: number
  kind: 'start' | 'killed' | 'botkilled' | 'storm' | 'extracted' | 'loot' | 'botkill'
  label: string
  sub: string
  matchId: string
}

interface ClusterResult {
  cx: number  // canvas logical coords (0-1024)
  cy: number
  radius: number
  items: Array<{ matchIdx: number; matchId: string; humanCount: number }>
}

function playerColor(userId: string) {
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]
}

const EVENT_STYLES: Record<string, { color: string; symbol: string; size: number }> = {
  Kill:           { color: '#EF4444', symbol: '●', size: 10 },  // killed a player — red dot
  Killed:         { color: '#EF4444', symbol: '✕', size: 15 },  // killed by player — red cross
  BotKill:        { color: '#F97316', symbol: '●', size: 9  },  // killed a bot — orange dot
  BotKilled:      { color: '#7C3AED', symbol: '✕', size: 14 },  // killed by bot — purple cross
  KilledByStorm:  { color: '#8B5CF6', symbol: '⚡', size: 14 },
  Loot:           { color: '#FCD34D', symbol: '★', size: 12 },
}

const INSIGHT_COLORS: Record<string, string> = {
  frustration_zone: 'rgb(239,68,68)',
  dead_zone:        'rgb(59,130,246)',
  choke_point:      'rgb(251,146,60)',
  hot_drop:         'rgb(250,204,21)',
  storm_cluster:    'rgb(167,139,250)',
  loot_black_hole:  'rgb(52,211,153)',
  combat_hotspot:   'rgb(244,114,182)',
}

const MARKER_STYLES: Record<Marker['kind'], { color: string; symbol: string }> = {
  start:     { color: '#22D3EE', symbol: '▶' },
  killed:    { color: '#EF4444', symbol: '✕' },
  botkilled: { color: '#A855F7', symbol: '✕' },
  storm:     { color: '#A78BFA', symbol: '⚡' },
  extracted: { color: '#4ADE80', symbol: '◉' },
  loot:      { color: '#FCD34D', symbol: '★' },
  botkill:   { color: '#F97316', symbol: '●' },
}

// ── Draw helpers ─────────────────────────────────────────────────────────────

function drawHeatmap(ctx: CanvasRenderingContext2D, events: PlayerEvent[], showHumans: boolean, showBots: boolean) {
  // Heatmap shows movement density — use Position events, not combat toggles
  const filtered = events.filter(e => {
    if (e.event_type === 'Position') return showHumans && !e.is_bot
    if (e.event_type === 'BotPosition') return showBots && e.is_bot
    return false
  })
  if (filtered.length === 0) return

  const RADIUS = 30

  ctx.save()

  for (const e of filtered) {
    const { pixel_x: x, pixel_y: y } = e
    const grad = ctx.createRadialGradient(x, y, 0, x, y, RADIUS)
    grad.addColorStop(0,   'rgba(255, 50,  0, 0.35)')
    grad.addColorStop(0.4, 'rgba(255, 150, 0, 0.15)')
    grad.addColorStop(1,   'rgba(255, 200, 0, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawPaths(
  ctx: CanvasRenderingContext2D,
  events: PlayerEvent[],
  showHumans: boolean,
  showBots: boolean,
  highlightedMatchId: string | null
) {
  const byPlayer: Record<string, PlayerEvent[]> = {}
  for (const e of events) {
    if (e.event_type !== 'Position' && e.event_type !== 'BotPosition') continue
    if (e.is_bot && !showBots) continue
    if (!e.is_bot && !showHumans) continue
    const key = `${e.match_id}:${e.user_id}`
    if (!byPlayer[key]) byPlayer[key] = []
    byPlayer[key].push(e)
  }
  for (const [key, pts] of Object.entries(byPlayer)) {
    if (pts.length < 2) continue
    const matchId = key.split(':')[0]
    const uid = pts[0].user_id
    const isBot = pts[0].is_bot
    const dimmed = highlightedMatchId !== null && matchId !== highlightedMatchId
    ctx.beginPath()
    ctx.strokeStyle = isBot ? 'rgba(150,150,150,0.35)' : playerColor(uid)
    ctx.lineWidth = isBot ? 1 : (dimmed ? 1 : 2)
    ctx.globalAlpha = dimmed ? 0.07 : (isBot ? 0.5 : 0.85)
    ctx.moveTo(pts[0].pixel_x, pts[0].pixel_y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].pixel_x, pts[i].pixel_y)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

// ── Primitive canvas shapes (crisp at any DPR / zoom) ─────────────────────

function filledCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  fill: string, outline: string,
  alpha: number, glow: number
) {
  ctx.save()
  ctx.globalAlpha = alpha
  if (glow > 0) { ctx.shadowColor = fill; ctx.shadowBlur = glow }
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (outline) {
    ctx.lineWidth = 1.5
    ctx.strokeStyle = outline
    ctx.stroke()
  }
  ctx.restore()
}

function crossMark(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  color: string, alpha: number
) {
  const half = size / 2
  const thick = Math.max(2, size * 0.22)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = thick
  ctx.lineCap = 'round'
  if (alpha > 0.5) { ctx.shadowColor = color; ctx.shadowBlur = 10 }
  ctx.beginPath()
  ctx.moveTo(x - half, y - half); ctx.lineTo(x + half, y + half)
  ctx.moveTo(x + half, y - half); ctx.lineTo(x - half, y + half)
  ctx.stroke()
  ctx.restore()
}

function glyphText(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  glyph: string, color: string, alpha: number
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `bold ${size}px sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (alpha > 0.5) { ctx.shadowColor = color; ctx.shadowBlur = 6 }
  ctx.fillText(glyph, x, y)
  ctx.restore()
}

// ── Event markers — drawn in z-order (Loot → kills → deaths on top) ─────────

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  events: PlayerEvent[],
  activeEventTypes: EventType[],
  showHumans: boolean,
  showBots: boolean,
  highlightedMatchId: string | null
) {
  const MOVEMENT = new Set(['Position', 'BotPosition'])
  // Bucket by type for controlled z-order
  const layers: Record<string, PlayerEvent[]> = {
    Loot: [], KilledByStorm: [], BotKill: [], Kill: [], BotKilled: [], Killed: []
  }
  for (const e of events) {
    if (MOVEMENT.has(e.event_type)) continue
    if (!activeEventTypes.includes(e.event_type)) continue
    if (e.is_bot && !showBots) continue
    if (!e.is_bot && !showHumans) continue
    if (layers[e.event_type]) layers[e.event_type].push(e)
  }

  const dim = (e: PlayerEvent) =>
    highlightedMatchId !== null && e.match_id !== highlightedMatchId ? 0.07 : 1

  // Loot — bottom layer, subtle star
  for (const e of layers.Loot) {
    glyphText(ctx, e.pixel_x, e.pixel_y, 11, '★', '#FCD34D', dim(e) * 0.9)
  }

  // Storm deaths
  for (const e of layers.KilledByStorm) {
    glyphText(ctx, e.pixel_x, e.pixel_y, 14, '⚡', '#A78BFA', dim(e))
  }

  // Bot kills — orange filled circle (main fix: arc instead of fillText)
  for (const e of layers.BotKill) {
    const a = dim(e)
    filledCircle(ctx, e.pixel_x, e.pixel_y, 7, '#F97316', '#FED7AA', a, a > 0.5 ? 14 : 0)
  }

  // PvP kills — red filled circle
  for (const e of layers.Kill) {
    const a = dim(e)
    filledCircle(ctx, e.pixel_x, e.pixel_y, 8, '#EF4444', '#FCA5A5', a, a > 0.5 ? 16 : 0)
  }

  // Bot killed player — purple cross
  for (const e of layers.BotKilled) {
    crossMark(ctx, e.pixel_x, e.pixel_y, 13, '#A855F7', dim(e))
  }

  // Player killed by player — red cross (topmost)
  for (const e of layers.Killed) {
    crossMark(ctx, e.pixel_x, e.pixel_y, 14, '#EF4444', dim(e))
  }
}

function drawInsightZones(ctx: CanvasRenderingContext2D, insights: Insight[]) {
  // Dead zones cover most of the map and create a grid — skip them on canvas
  // (they're still visible in the Insights side panel)
  const visible = insights.filter(i => i.type !== 'dead_zone')
  if (visible.length === 0) return

  const borderAlpha: Record<string, number> = { high: 0.35, medium: 0.35, low: 0.35 }
  const fillAlpha:   Record<string, number> = { high: 0.35, medium: 0.35, low: 0.35 }
  const LABEL: Record<string, string> = {
    frustration_zone: 'FZ', choke_point: 'CP',
    hot_drop: 'HD', storm_cluster: 'SC', loot_black_hole: 'LBH', combat_hotspot: 'CH',
  }
  const R = 5

  for (const ins of visible) {
    const color = INSIGHT_COLORS[ins.type] ?? 'rgb(255,255,255)'
    const ba = borderAlpha[ins.severity] ?? 0.60
    const fa = fillAlpha[ins.severity]   ?? 0.08
    const x = ins.pixel_x1
    const y = ins.pixel_y1
    const w = ins.pixel_x2 - ins.pixel_x1
    const h = ins.pixel_y2 - ins.pixel_y1

    // Very subtle tint
    ctx.globalAlpha = fa
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, R)
    ctx.fill()

    // Bold border
    ctx.globalAlpha = ba
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, R)
    ctx.stroke()

    // Label badge
    const tag = LABEL[ins.type]
    if (tag && w > 25) {
      const pad = 4
      ctx.font = 'bold 9px sans-serif'
      const tw = ctx.measureText(tag).width
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(x + 4, y + 4, tw + pad * 2, 14)
      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(tag, x + 4 + pad, y + 5)
    }
  }
  ctx.globalAlpha = 1
}

// Returns clusters for hover detection. zoom is the current canvas zoom level.
function drawStartEndMarkers(
  ctx: CanvasRenderingContext2D,
  markers: Marker[],
  highlightedMatchId: string | null,
  zoom: number,
  matches: Match[],
): ClusterResult[] {
  // Cluster radius in canvas pixels — shrinks as you zoom in so clusters break apart naturally
  const CLUSTER_R = 36 / zoom

  const startMarkers = markers.filter(m => m.kind === 'start')
  const otherMarkers = markers.filter(m => m.kind !== 'start' && m.kind !== 'loot' && m.kind !== 'botkill')

  // ── Build clusters (greedy, nearest-centroid) ─────────────────────────────
  const rawClusters: { members: Marker[]; cx: number; cy: number }[] = []
  for (const m of startMarkers) {
    let placed = false
    for (const c of rawClusters) {
      if (Math.hypot(c.cx - m.cx, c.cy - m.cy) < CLUSTER_R) {
        c.members.push(m)
        // Recompute centroid
        c.cx = c.members.reduce((s, x) => s + x.cx, 0) / c.members.length
        c.cy = c.members.reduce((s, x) => s + x.cy, 0) / c.members.length
        placed = true
        break
      }
    }
    if (!placed) rawClusters.push({ members: [m], cx: m.cx, cy: m.cy })
  }

  const clusterColor = '#22D3EE'

  // ── Draw each cluster ─────────────────────────────────────────────────────
  for (const c of rawClusters) {
    const isMulti = c.members.length > 1
    const isDimmed = highlightedMatchId !== null &&
      !c.members.some(m => m.matchId === highlightedMatchId)
    const alpha = isDimmed ? 0.07 : 1
    // Radius grows slightly with count, capped so it doesn't get huge
    const R = isMulti ? Math.min(18, 11 + Math.floor(Math.log2(c.members.length + 1) * 2.5)) : 9

    ctx.save()

    if (isMulti) {
      // Outer halo ring
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, R + 5, 0, Math.PI * 2)
      ctx.strokeStyle = clusterColor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.25 * alpha
      ctx.stroke()

      // Filled circle
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, R, 0, Math.PI * 2)
      ctx.fillStyle = clusterColor
      ctx.globalAlpha = alpha
      ctx.fill()

      // Dark inner cutout for contrast
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, R - 3.5, 0, Math.PI * 2)
      ctx.fillStyle = '#071520'
      ctx.fill()

      // Count text
      const count = c.members.length
      ctx.font = `bold ${count >= 100 ? 8 : count >= 10 ? 9 : 10}px sans-serif`
      ctx.fillStyle = clusterColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = alpha
      ctx.fillText(String(count), c.cx, c.cy)
    } else {
      // Single start — outline circle with ▶
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, R, 0, Math.PI * 2)
      ctx.fillStyle = '#0d0d0d'
      ctx.globalAlpha = 0.85 * alpha
      ctx.fill()

      ctx.beginPath()
      ctx.arc(c.cx, c.cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = clusterColor
      ctx.lineWidth = 2
      ctx.globalAlpha = alpha
      ctx.stroke()

      ctx.font = 'bold 8px sans-serif'
      ctx.fillStyle = clusterColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = alpha
      ctx.fillText('▶', c.cx, c.cy)
    }

    ctx.restore()
  }

  // ── Draw non-start end/death markers ─────────────────────────────────────
  for (const m of otherMarkers) {
    const { color, symbol } = MARKER_STYLES[m.kind]
    const dimFactor = (highlightedMatchId !== null && m.matchId !== highlightedMatchId) ? 0.07 : 1
    const R = 9

    ctx.beginPath()
    ctx.arc(m.cx, m.cy, R + 2, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.3 * dimFactor
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(m.cx, m.cy, R, 0, Math.PI * 2)
    ctx.fillStyle = '#0d0d0d'
    ctx.globalAlpha = 0.85 * dimFactor
    ctx.fill()

    ctx.beginPath()
    ctx.arc(m.cx, m.cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = dimFactor
    ctx.stroke()

    ctx.font = `bold ${m.kind === 'storm' ? 9 : 8}px sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = dimFactor
    ctx.fillText(symbol, m.cx, m.cy)
    ctx.globalAlpha = 1
  }

  // ── Return cluster data for hover detection ───────────────────────────────
  return rawClusters.map(c => ({
    cx: c.cx,
    cy: c.cy,
    radius: c.members.length > 1
      ? Math.min(18, 11 + Math.floor(Math.log2(c.members.length + 1) * 2.5)) + 6
      : 12,
    items: c.members.map(m => {
      const idx = matches.findIndex(mm => mm.match_id === m.matchId)
      return { matchIdx: idx, matchId: m.matchId, humanCount: matches[idx]?.human_count ?? 0 }
    }),
  }))
}

function drawMatchLabels(ctx: CanvasRenderingContext2D, events: PlayerEvent[], matchIds: string[], matches: Match[], highlightedMatchId: string | null = null) {
  if (matchIds.length < 2) return
  for (const [idx, match] of matches.entries()) {
    const matchId = match.match_id
    const first = events.find(e => e.match_id === matchId && e.event_type === 'Position' && !e.is_bot)
    if (!first) continue
    const color = MATCH_COLORS[idx % MATCH_COLORS.length]
    const dimFactor = (highlightedMatchId !== null && matchId !== highlightedMatchId) ? 0.2 : 1
    const x = first.pixel_x
    const y = first.pixel_y
    const tagText = match
      ? `Match #${match.map_match_number}  ${match.human_count}H${match.bot_count > 0 ? ` ${match.bot_count}B` : ''}`
      : `Match #?`

    // Dot
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fillStyle = '#111'
    ctx.globalAlpha = 0.85 * dimFactor
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = dimFactor
    ctx.stroke()
    ctx.font = 'bold 9px sans-serif'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = dimFactor
    ctx.fillText(`M${idx + 1}`, x, y)

    // Tag
    ctx.font = 'bold 11px sans-serif'
    const tw = ctx.measureText(tagText).width
    const pad = 6
    const tagH = 20
    const tagX = x + 13
    const tagY = y - tagH / 2
    ctx.fillStyle = '#0a0a0a'
    ctx.globalAlpha = 0.9 * dimFactor
    ctx.beginPath()
    ctx.roundRect?.(tagX, tagY, tw + pad * 2, tagH, 3)
    ctx.fill()
    ctx.globalAlpha = dimFactor
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect?.(tagX, tagY, tw + pad * 2, tagH, 3)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = dimFactor
    ctx.fillText(tagText, tagX + pad, y)
    ctx.globalAlpha = 1
  }
}

function drawRegionBox(ctx: CanvasRenderingContext2D, region: Region, isDraft: boolean) {
  const x = Math.min(region.x1, region.x2)
  const y = Math.min(region.y1, region.y2)
  const w = Math.abs(region.x2 - region.x1)
  const h = Math.abs(region.y2 - region.y1)
  ctx.strokeStyle = isDraft ? 'rgba(96,165,250,0.8)' : 'rgba(96,165,250,1)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = 'rgba(96,165,250,0.08)'
  ctx.fillRect(x, y, w, h)
  ctx.setLineDash([])
}

// ── Marker computation ───────────────────────────────────────────────────────

function computeMarkers(events: PlayerEvent[], matchIds: string[], matches: Match[]): Marker[] {
  const result: Marker[] = []

  // Group human events by (match_id:user_id)
  const byPlayer: Record<string, PlayerEvent[]> = {}
  for (const e of events) {
    if (e.is_bot) continue
    const key = `${e.match_id}:${e.user_id}`
    if (!byPlayer[key]) byPlayer[key] = []
    byPlayer[key].push(e)
  }

  for (const [key, pEvents] of Object.entries(byPlayer)) {
    const matchId = key.split(':')[0]
    const matchIdx = matches.findIndex(m => m.match_id === matchId)
    const match = matches[matchIdx]
    const matchLabel = match
      ? `Match #${match.map_match_number} · ${match.human_count}H${match.bot_count > 0 ? ` ${match.bot_count}B` : ''}`
      : matchId.slice(0, 8)

    const sorted = [...pEvents].sort((a, b) => a.ts - b.ts)

    // Start
    const firstPos = sorted.find(e => e.event_type === 'Position')
    if (firstPos) {
      result.push({ cx: firstPos.pixel_x, cy: firstPos.pixel_y, kind: 'start', label: 'Start', sub: matchLabel, matchId })
    }

    // End
    const lastPos = [...sorted].reverse().find(e => e.event_type === 'Position')
    if (lastPos) {
      const killedByPlayer = sorted.some(e => e.event_type === 'Killed')
      const killedByBot    = sorted.some(e => e.event_type === 'BotKilled')
      const storm          = sorted.some(e => e.event_type === 'KilledByStorm')
      const kind: Marker['kind'] = (killedByPlayer || killedByBot) ? 'killed' : storm ? 'storm' : 'extracted'
      const label = killedByPlayer ? 'Killed by Player'
                  : killedByBot    ? 'Killed by Bot'
                  : storm          ? 'Storm Kill'
                  : 'Survived'
      result.push({ cx: lastPos.pixel_x, cy: lastPos.pixel_y, kind, label, sub: matchLabel, matchId })
    }

    // All non-position events → hoverable
    for (const e of sorted) {
      let label: string | null = null
      let kind: Marker['kind'] = 'loot'
      if (e.event_type === 'Loot')          { label = 'Loot';              kind = 'loot'    }
      else if (e.event_type === 'Kill')     { label = 'Killed a Player';   kind = 'killed'  }
      else if (e.event_type === 'Killed')   { label = 'Killed by Player';  kind = 'killed'  }
      else if (e.event_type === 'BotKill')  { label = 'Killed a Bot';      kind = 'botkill' }
      else if (e.event_type === 'BotKilled'){ label = 'Killed by Bot';     kind = 'botkilled' }
      else if (e.event_type === 'KilledByStorm') { label = 'Storm Kill';   kind = 'storm'   }
      if (label) {
        result.push({ cx: e.pixel_x, cy: e.pixel_y, kind, label, sub: matchLabel, matchId })
      }
    }
  }

  return result
}

// ── Axis scales ──────────────────────────────────────────────────────────────

function drawAxisScales(ctx: CanvasRenderingContext2D, mapId: MapId) {
  const cfg = MAP_CONFIGS[mapId]
  const INTERVAL = 100   // world units between ticks

  ctx.save()
  ctx.font = 'bold 9px monospace'
  ctx.lineWidth = 0.5

  // X axis — bottom edge
  const x0 = Math.ceil(cfg.origin_x / INTERVAL) * INTERVAL
  for (let wx = x0; wx <= cfg.origin_x + cfg.scale; wx += INTERVAL) {
    const px = ((wx - cfg.origin_x) / cfg.scale) * CANVAS_SIZE
    // tick line
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath(); ctx.moveTo(px, CANVAS_SIZE - 14); ctx.lineTo(px, CANVAS_SIZE); ctx.stroke()
    // label with dark backing
    const label = String(wx)
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(px - tw / 2 - 2, CANVAS_SIZE - 25, tw + 4, 11)
    ctx.fillStyle = 'rgba(200,220,255,0.65)'
    ctx.fillText(label, px, CANVAS_SIZE - 15)
  }

  // Z axis — left edge
  const z0 = Math.ceil(cfg.origin_z / INTERVAL) * INTERVAL
  for (let wz = z0; wz <= cfg.origin_z + cfg.scale; wz += INTERVAL) {
    const py = (1 - (wz - cfg.origin_z) / cfg.scale) * CANVAS_SIZE
    // tick line
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(14, py); ctx.stroke()
    // label with dark backing
    const label = String(wz)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(15, py - 6, tw + 4, 12)
    ctx.fillStyle = 'rgba(200,220,255,0.65)'
    ctx.fillText(label, 17, py)
  }

  ctx.restore()
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  mapId: MapId
  events: PlayerEvent[]
  currentTime: number
  showHumans: boolean
  showBots: boolean
  activeEventTypes: EventType[]
  viewMode: 'paths' | 'heatmap'
  insights: Insight[]
  showInsights: boolean
  matchIds: string[]
  matches: Match[]
  selectedRegion: Region | null
  draftRegion: Region | null
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void
  highlightedMatchId: string | null
  onHighlightChange: (id: string | null) => void
  annotations?: AIAnnotation[]
  showAnnotations?: boolean
  onAnnotationAsk?: (ann: AIAnnotation) => void
  onSetRegion?: (r: Region) => void
}

export default function MapViewer({
  mapId, events, currentTime, showHumans, showBots,
  activeEventTypes, viewMode, insights, showInsights, matchIds, matches,
  selectedRegion, draftRegion, onMouseDown, onMouseMove, onMouseUp,
  highlightedMatchId, onHighlightChange,
  annotations = [], showAnnotations = true, onAnnotationAsk,
  onSetRegion,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const outerRef  = useRef<HTMLDivElement>(null)
  const config    = MAP_CONFIGS[mapId]

  // Zoom / pan
  const [xform, setXform] = useState({ zoom: 1, panX: 0, panY: 0 })
  const isPanning = useRef(false)
  const panStart  = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const dprRef    = useRef(1)

  // DPR canvas setup — runs once on mount, never conflicts with React's reconciler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    dprRef.current = dpr
    canvas.width  = CANVAS_SIZE * dpr
    canvas.height = CANVAS_SIZE * dpr
  }, [])

  // Hover tooltip (individual markers)
  const markersRef = useRef<Marker[]>([])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; marker: Marker } | null>(null)
  const [cursorWorld, setCursorWorld] = useState<{ x: number; z: number } | null>(null)

  // Cluster popup — hover preview (pinned=false) or click-locked (pinned=true)
  const clustersRef = useRef<ClusterResult[]>([])
  const [clusterPopup, setClusterPopup] = useState<{
    x: number; y: number; cluster: ClusterResult; flipUp: boolean; flipLeft: boolean; pinned: boolean
  } | null>(null)

  // Annotation pin popover
  const [annotationPopover, setAnnotationPopover] = useState<{
    ann: AIAnnotation; x: number; y: number; flipLeft: boolean; flipUp: boolean
  } | null>(null)

  // Coordinate input form
  const [showCoordInput, setShowCoordInput] = useState(false)
  const [coordInputs, setCoordInputs] = useState({ x1: '', z1: '', x2: '', z2: '' })

  // Corner drag state for resizing selection
  const draggingCorner = useRef<'tl' | 'tr' | 'bl' | 'br' | null>(null)
  const dragBaseRegion = useRef<Region | null>(null)

  const handlePinClick = useCallback((e: React.MouseEvent, ann: AIAnnotation) => {
    e.stopPropagation()
    const rect = outerRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setAnnotationPopover(prev =>
      prev?.ann.id === ann.id ? null : {
        ann, x, y,
        flipLeft: x + 300 > rect.width,
        flipUp: y + 180 > rect.height - 20,
      }
    )
  }, [])

  const matchKey = matchIds.join(',')
  useEffect(() => {
    setXform({ zoom: 1, panX: 0, panY: 0 })
    onHighlightChange(null)
    setAnnotationPopover(null)
  }, [mapId, matchKey, onHighlightChange])

  // Clamp pan so the map always covers the full container — no black edges
  const clampPan = useCallback((panX: number, panY: number, zoom: number) => {
    const el = outerRef.current
    if (!el || zoom <= 1) return { panX: 0, panY: 0 }
    const { width: W, height: H } = el.getBoundingClientRect()
    return {
      panX: Math.min(0, Math.max(W * (1 - zoom), panX)),
      panY: Math.min(0, Math.max(H * (1 - zoom), panY)),
    }
  }, [])


  const zoomTo = useCallback((factor: number) => {
    const el = outerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    setXform(prev => {
      const newZoom = Math.max(1, Math.min(6, prev.zoom * factor))
      if (newZoom <= 1) return { zoom: 1, panX: 0, panY: 0 }
      const rawX = cx - ((cx - prev.panX) / prev.zoom) * newZoom
      const rawY = cy - ((cy - prev.panY) / prev.zoom) * newZoom
      const { width: W, height: H } = rect
      return {
        zoom: newZoom,
        panX: Math.min(0, Math.max(W * (1 - newZoom), rawX)),
        panY: Math.min(0, Math.max(H * (1 - newZoom), rawY)),
      }
    })
  }, [])

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use stored DPR from mount effect — never resize canvas here
    const dpr = dprRef.current
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    const visible = events.filter(e => e.ts <= currentTime)

    if (viewMode === 'heatmap') {
      drawHeatmap(ctx, visible, showHumans, showBots)
    } else {
      drawPaths(ctx, visible, showHumans, showBots, highlightedMatchId)
      drawMarkers(ctx, visible, activeEventTypes, showHumans, showBots, highlightedMatchId)
    }

    const computed = computeMarkers(visible, matchIds, matches)
    markersRef.current = computed
    drawMatchLabels(ctx, visible, matchIds, matches, highlightedMatchId)
    clustersRef.current = drawStartEndMarkers(ctx, computed, highlightedMatchId, xform.zoom, matches)

    // Draw insights on top of everything so they're always visible
    if (showInsights) drawInsightZones(ctx, insights)

    if (selectedRegion) drawRegionBox(ctx, selectedRegion, false)
    if (draftRegion) drawRegionBox(ctx, draftRegion, true)

    // Axis scales — always on top
    drawAxisScales(ctx, mapId)

    ctx.restore()
  }, [events, currentTime, showHumans, showBots, activeEventTypes, viewMode,
      insights, showInsights, matchIds, matches, selectedRegion, draftRegion, highlightedMatchId, xform])

  // Shared helper — compute popup position flags
  const clusterPopupPos = useCallback((relX: number, relY: number, itemCount: number) => {
    const containerRect = outerRef.current!.getBoundingClientRect()
    const POPUP_H = 80 + Math.min(itemCount, 13) * 32
    const flipUp   = relY + POPUP_H > containerRect.height - 20
    const flipLeft = relX + 224 > containerRect.width
    return { flipUp, flipLeft }
  }, [])

  // Canvas event wrappers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.shiftKey) { onMouseDown(e); return }
    if (xform.zoom > 1) {
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, px: xform.panX, py: xform.panY }
      return
    }

    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
    const canvasY = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height)
    const outerRect = outerRef.current!.getBoundingClientRect()
    const relX = e.clientX - outerRect.left
    const relY = e.clientY - outerRect.top

    // Click on a cluster → pin popup
    for (const c of clustersRef.current) {
      if (c.items.length > 1 && Math.hypot(c.cx - canvasX, c.cy - canvasY) < c.radius) {
        const { flipUp, flipLeft } = clusterPopupPos(relX, relY, c.items.length)
        setClusterPopup(prev =>
          // Toggle off if clicking same pinned cluster
          prev?.pinned && Math.hypot(prev.cluster.cx - c.cx, prev.cluster.cy - c.cy) < 5
            ? null
            : { x: relX, y: relY, cluster: c, flipUp, flipLeft, pinned: true }
        )
        return
      }
    }

    // Clicking anywhere else closes pinned popup
    setClusterPopup(null)

    // Don't clear selection when clicking inside the selected region
    if (selectedRegion) {
      const minX = Math.min(selectedRegion.x1, selectedRegion.x2)
      const maxX = Math.max(selectedRegion.x1, selectedRegion.x2)
      const minY = Math.min(selectedRegion.y1, selectedRegion.y2)
      const maxY = Math.max(selectedRegion.y1, selectedRegion.y2)
      if (canvasX >= minX && canvasX <= maxX && canvasY >= minY && canvasY <= maxY) return
    }

    // Match highlight: click near a marker to highlight its match; click empty to clear
    if (matchIds.length > 1) {
      const THRESHOLD = 20
      let best: Marker | null = null
      let bestDist = THRESHOLD
      for (const m of markersRef.current) {
        const d = Math.hypot(m.cx - canvasX, m.cy - canvasY)
        if (d < bestDist) { bestDist = d; best = m }
      }
      if (best) {
        onHighlightChange(highlightedMatchId === best!.matchId ? null : best!.matchId)
        return
      }
      onHighlightChange(null)
    }
    onMouseDown(e)
  }, [xform, onMouseDown, matchIds, clusterPopupPos, selectedRegion])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setXform(prev => {
        const rawX = panStart.current.px + dx
        const rawY = panStart.current.py + dy
        const clamped = clampPan(rawX, rawY, prev.zoom)
        return { ...prev, ...clamped }
      })
      return
    }
    onMouseMove(e)

    // Hover detection
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
    const canvasY = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height)
    setCursorWorld(pixelToWorld(canvasX, canvasY, mapId))

    const THRESHOLD = 14
    let best: Marker | null = null
    let bestDist = THRESHOLD
    for (const m of markersRef.current) {
      const d = Math.hypot(m.cx - canvasX, m.cy - canvasY)
      if (d < bestDist) { bestDist = d; best = m }
    }

    const outerRect = outerRef.current!.getBoundingClientRect()
    const relX = e.clientX - outerRect.left
    const relY = e.clientY - outerRect.top

    // Check cluster hover — only update if popup isn't pinned
    let onCluster = false
    for (const c of clustersRef.current) {
      if (c.items.length > 1 && Math.hypot(c.cx - canvasX, c.cy - canvasY) < c.radius) {
        if (!clusterPopup?.pinned) {
          const { flipUp, flipLeft } = clusterPopupPos(relX, relY, c.items.length)
          setClusterPopup({ x: relX, y: relY, cluster: c, flipUp, flipLeft, pinned: false })
        }
        setTooltip(null)
        onCluster = true
        break
      }
    }

    if (!onCluster) {
      // Don't dismiss a pinned popup when moving off cluster
      if (!clusterPopup?.pinned) setClusterPopup(null)
      if (best) {
        setTooltip({ x: relX, y: relY, marker: best })
      } else {
        setTooltip(null)
      }
    }
  }, [onMouseMove, clampPan, clusterPopup, clusterPopupPos])

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) { isPanning.current = false; return }
    onMouseUp(e)
  }, [onMouseUp])

  // Outer-div handlers for corner-drag resizing
  const handleOuterMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingCorner.current || !dragBaseRegion.current || !outerRef.current) return
    const rect = outerRef.current.getBoundingClientRect()
    const { zoom: z, panX: px, panY: py } = xform
    const canvasX = Math.max(0, Math.min(1024, ((e.clientX - rect.left - px) / z) / rect.width  * 1024))
    const canvasY = Math.max(0, Math.min(1024, ((e.clientY - rect.top  - py) / z) / rect.height * 1024))
    const r = { ...dragBaseRegion.current }
    const c = draggingCorner.current
    if (c === 'tl') { r.x1 = canvasX; r.y1 = canvasY }
    else if (c === 'tr') { r.x2 = canvasX; r.y1 = canvasY }
    else if (c === 'bl') { r.x1 = canvasX; r.y2 = canvasY }
    else if (c === 'br') { r.x2 = canvasX; r.y2 = canvasY }
    dragBaseRegion.current = r
    onSetRegion?.(r)
  }, [xform, onSetRegion])

  const handleOuterMouseUp = useCallback(() => {
    draggingCorner.current = null
    dragBaseRegion.current = null
  }, [])

  const { zoom, panX, panY } = xform

  return (
    <div
      ref={outerRef}
      className="relative w-full h-full select-none"
      onMouseMove={handleOuterMouseMove}
      onMouseUp={handleOuterMouseUp}
      onMouseLeave={handleOuterMouseUp}
    >
      {/* Clipped zoom area */}
      <div className="absolute inset-0 overflow-hidden">
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.image} alt={mapId} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: zoom > 1 ? 'grab' : 'crosshair' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => { setTooltip(null); setClusterPopup(p => p?.pinned ? p : null); setCursorWorld(null) }}
          />

          {/* AI annotation rings (SVG, pan/zooms with map) */}
          {showAnnotations && annotations.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1024 1024"
              preserveAspectRatio="none"
            >
              {annotations.map(ann => (
                <g key={ann.id}>
                  {/* Static dim ring */}
                  <circle
                    cx={ann.center_px} cy={ann.center_py} r={ann.radius}
                    fill="none" stroke={ann.color} strokeWidth="1.5" opacity="0.25"
                  />
                  {/* Pulsing outer ring */}
                  <circle
                    cx={ann.center_px} cy={ann.center_py} r={ann.radius}
                    fill="none" stroke={ann.color} strokeWidth="2" opacity="0.7"
                    strokeDasharray="6 4"
                  >
                    <animate attributeName="r"
                      values={`${ann.radius};${ann.radius * 1.25};${ann.radius}`}
                      dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity"
                      values="0.7;0;0.7"
                      dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Soft fill */}
                  <circle
                    cx={ann.center_px} cy={ann.center_py} r={ann.radius * 0.7}
                    fill={ann.color} opacity="0.04"
                  />
                </g>
              ))}
            </svg>
          )}

          {/* Selected region — draggable corner handles with coord labels */}
          {selectedRegion && (
            <>
              {([
                { px: selectedRegion.x1, py: selectedRegion.y1, corner: 'tl' as const, labelRight: false, labelBelow: false },
                { px: selectedRegion.x2, py: selectedRegion.y1, corner: 'tr' as const, labelRight: true,  labelBelow: false },
                { px: selectedRegion.x1, py: selectedRegion.y2, corner: 'bl' as const, labelRight: false, labelBelow: true  },
                { px: selectedRegion.x2, py: selectedRegion.y2, corner: 'br' as const, labelRight: true,  labelBelow: true  },
              ]).map(({ px, py, corner, labelRight, labelBelow }) => {
                const { x, z } = pixelToWorld(px, py, mapId)
                return (
                  <div
                    key={corner}
                    className="absolute z-20 pointer-events-auto"
                    style={{ left: `${(px / 1024) * 100}%`, top: `${(py / 1024) * 100}%` }}
                  >
                    {/* Drag handle square */}
                    <div
                      className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-sm shadow-lg"
                      style={{
                        transform: 'translate(-50%, -50%)',
                        cursor: 'crosshair',
                        touchAction: 'none',
                      }}
                      onMouseDown={e => {
                        e.stopPropagation()
                        e.preventDefault()
                        draggingCorner.current = corner
                        dragBaseRegion.current = { ...selectedRegion }
                      }}
                    />
                    {/* Coord label */}
                    <div
                      className="absolute bg-gray-950/90 border border-blue-700/50 rounded px-1.5 py-0.5 font-mono text-[9px] text-blue-300 whitespace-nowrap pointer-events-none"
                      style={{
                        left:   labelRight ? 'auto' : '6px',
                        right:  labelRight ? '6px'  : 'auto',
                        top:    labelBelow ? '6px'  : 'auto',
                        bottom: labelBelow ? 'auto' : '6px',
                      }}
                    >
                      {Math.round(x)}, {Math.round(z)}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* AI annotation pins (HTML, pan/zooms with map) */}
          {showAnnotations && annotations.map(ann => (
            <div
              key={`pin-${ann.id}`}
              className="absolute z-20 pointer-events-auto"
              style={{
                left: `${(ann.center_px / 1024) * 100}%`,
                top: `${(ann.center_py / 1024) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <button
                onClick={e => handlePinClick(e, ann)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-xl transition-all hover:scale-105"
                style={{
                  background: 'rgba(8, 9, 14, 0.88)',
                  borderColor: ann.color,
                  color: '#f0f4ff',
                  marginTop: `${(ann.radius / 1024) * 100 + 2}%`,
                  boxShadow: `0 0 10px ${ann.color}40`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: ann.color }} />
                {ann.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip — outside overflow-hidden */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none animate-pop-in"
          style={{ left: tooltip.x + 16, top: tooltip.y - 44 }}
        >
          <div
            className="bg-gray-950/95 border rounded-xl px-3 py-2.5 shadow-2xl min-w-max backdrop-blur-sm"
            style={{ borderColor: MARKER_STYLES[tooltip.marker.kind].color + '50' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-xs flex-shrink-0"
                style={{ background: MARKER_STYLES[tooltip.marker.kind].color + '22', color: MARKER_STYLES[tooltip.marker.kind].color }}
              >
                {MARKER_STYLES[tooltip.marker.kind].symbol}
              </span>
              <span className="text-white text-xs font-semibold">{tooltip.marker.label}</span>
            </div>
            <div className="text-gray-500 text-[10px] mt-1 pl-7">{tooltip.marker.sub}</div>
          </div>
        </div>
      )}

      {/* Cluster popup — hover preview or click-pinned */}
      {clusterPopup && (
        <div
          className="absolute z-40 animate-pop-in"
          style={{
            left: clusterPopup.flipLeft ? clusterPopup.x - 224 : clusterPopup.x + 16,
            top:    clusterPopup.flipUp ? 'auto' : Math.max(8, clusterPopup.y - 20),
            bottom: clusterPopup.flipUp ? `calc(100% - ${clusterPopup.y + 10}px)` : 'auto',
          }}
        >
          <div className={`bg-gray-950 rounded-xl shadow-2xl w-52 border flex flex-col ${
            clusterPopup.pinned ? 'border-cyan-500/60' : 'border-cyan-500/25'
          }`}>
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
              <span className="text-cyan-300 text-[11px] font-bold tracking-wide flex-1">
                {clusterPopup.cluster.items.length} matches here
              </span>
              <button
                className="text-gray-500 hover:text-white text-xs transition-colors leading-none"
                onClick={() => setClusterPopup(null)}
              >✕</button>
            </div>

            {/* Match list — 6 visible, scrollable for more */}
            <div className="overflow-y-auto py-1" style={{ maxHeight: `${6 * 40}px` }}>
              {clusterPopup.cluster.items.map(({ matchIdx, matchId, humanCount }) => {
                const color = MATCH_COLORS[matchIdx % MATCH_COLORS.length]
                const isHighlighted = highlightedMatchId === matchId
                return (
                  <div
                    key={matchId}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                      isHighlighted ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    onClick={() => { onHighlightChange(highlightedMatchId === matchId ? null : matchId); setClusterPopup(p => p ? { ...p, pinned: true } : null) }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-white text-[11px] font-medium flex-1">Match #{matches[matchIdx]?.map_match_number ?? matchIdx + 1}</span>
                    <span className="text-gray-500 text-[10px]">{humanCount}H</span>
                    {isHighlighted && <span className="text-cyan-400 text-[9px]">●</span>}
                  </div>
                )
              })}
            </div>
            {clusterPopup.cluster.items.length > 6 && (
              <div className="px-3 py-1.5 border-t border-gray-800 text-gray-600 text-[10px]">
                scroll for +{clusterPopup.cluster.items.length - 6} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Annotation popover */}
      {annotationPopover && (
        <div
          className="absolute z-40 animate-pop-in"
          style={{
            left: annotationPopover.flipLeft ? annotationPopover.x - 300 : annotationPopover.x + 12,
            top:    annotationPopover.flipUp ? 'auto' : Math.max(8, annotationPopover.y - 12),
            bottom: annotationPopover.flipUp ? `calc(100% - ${annotationPopover.y + 10}px)` : 'auto',
          }}
        >
          <div className="bg-gray-950 border rounded-xl shadow-2xl w-72 overflow-hidden"
            style={{ borderColor: `${annotationPopover.ann.color}40` }}
          >
            <div className="px-4 py-3 border-b border-gray-800/60 flex items-center gap-2"
              style={{ borderBottomColor: `${annotationPopover.ann.color}20` }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                style={{ background: annotationPopover.ann.color }} />
              <span className="text-xs font-bold flex-1" style={{ color: annotationPopover.ann.color }}>
                AI Analysis
              </span>
              <button
                onClick={() => setAnnotationPopover(null)}
                className="text-gray-600 hover:text-white text-xs transition-colors"
              >✕</button>
            </div>
            <div className="px-4 py-3">
              <p className="text-white text-xs font-semibold mb-2">{annotationPopover.ann.label}</p>
              <p className="text-gray-400 text-[11px] leading-relaxed">{annotationPopover.ann.description}</p>
            </div>
            {onAnnotationAsk && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => {
                    onAnnotationAsk(annotationPopover.ann)
                    setAnnotationPopover(null)
                  }}
                  className="w-full text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors"
                  style={{
                    borderColor: `${annotationPopover.ann.color}40`,
                    color: annotationPopover.ann.color,
                    background: `${annotationPopover.ann.color}0d`,
                  }}
                >
                  Ask AI why →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-10 right-2 flex flex-col gap-1 z-10">
        <button onClick={() => zoomTo(1.3)}
          className="w-7 h-7 bg-gray-900/90 hover:bg-gray-700 border border-gray-600 text-white text-base rounded flex items-center justify-center"
          title="Zoom in">+</button>
        <button onClick={() => setXform({ zoom: 1, panX: 0, panY: 0 })}
          className="w-7 h-7 bg-gray-900/90 hover:bg-gray-700 border border-gray-600 text-gray-400 text-xs rounded flex items-center justify-center"
          title="Reset zoom">⊙</button>
        <button onClick={() => zoomTo(1 / 1.3)}
          className="w-7 h-7 bg-gray-900/90 hover:bg-gray-700 border border-gray-600 text-white text-base rounded flex items-center justify-center"
          title="Zoom out">−</button>
      </div>

      {zoom > 1 && (
        <div className="absolute top-2 left-2 text-xs text-white bg-gray-900/80 border border-gray-700 px-2 py-0.5 rounded z-10">
          {Math.round(zoom * 100)}%
        </div>
      )}


      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between z-10 gap-2">
        {/* Live cursor coordinates */}
        <div className="bg-gray-950/90 border border-gray-800 px-2.5 py-1 rounded-lg font-mono text-[10px] min-w-36 pointer-events-none">
          {cursorWorld ? (
            <span className="text-gray-300">
              x <span className="text-blue-400 tabular-nums">{Math.round(cursorWorld.x)}</span>
              <span className="text-gray-600 mx-1.5">·</span>
              z <span className="text-blue-400 tabular-nums">{Math.round(cursorWorld.z)}</span>
            </span>
          ) : (
            <span className="text-gray-700">x — · z —</span>
          )}
        </div>

        {/* Coordinate input form */}
        {onSetRegion && (
          <div className="flex flex-col items-end gap-1">
            {showCoordInput && (
              <div className="bg-gray-950/98 border border-blue-800/60 rounded-xl px-3 py-2.5 shadow-2xl">
                <div className="text-[9px] text-blue-400 uppercase tracking-widest mb-2 font-bold">Set region by world coords</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {(['x1','z1','x2','z2'] as const).map(k => (
                    <div key={k} className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-500 w-4">{k}</span>
                      <input
                        type="number"
                        value={coordInputs[k]}
                        onChange={e => setCoordInputs(prev => ({ ...prev, [k]: e.target.value }))}
                        placeholder="—"
                        className="w-20 bg-gray-800 border border-gray-700 focus:border-blue-500 rounded px-1.5 py-0.5 text-[10px] text-white font-mono focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const { x1, z1, x2, z2 } = coordInputs
                    if ([x1, z1, x2, z2].some(v => v === '')) return
                    const cfg = MAP_CONFIGS[mapId]
                    const toPixel = (wx: number, wz: number) => ({
                      px: ((wx - cfg.origin_x) / cfg.scale) * 1024,
                      py: (1 - (wz - cfg.origin_z) / cfg.scale) * 1024,
                    })
                    const a = toPixel(parseFloat(x1), parseFloat(z1))
                    const b = toPixel(parseFloat(x2), parseFloat(z2))
                    onSetRegion({ x1: a.px, y1: a.py, x2: b.px, y2: b.py })
                    setShowCoordInput(false)
                  }}
                  className="mt-2 w-full text-[10px] py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
            <button
              onClick={() => setShowCoordInput(p => !p)}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                showCoordInput
                  ? 'bg-blue-600/20 border-blue-700/60 text-blue-300'
                  : 'bg-gray-950/90 border-gray-800 text-gray-500 hover:text-blue-400 hover:border-blue-800'
              }`}
            >
              ⌖ Set by coords
            </button>
          </div>
        )}

        {/* Hint */}
        <div className="text-[10px] text-gray-600 bg-gray-950/80 border border-gray-800 px-2.5 py-1 rounded-lg tracking-wide pointer-events-none">
          Shift+drag to select &nbsp;·&nbsp; Esc to clear
        </div>
      </div>
    </div>
  )
}
