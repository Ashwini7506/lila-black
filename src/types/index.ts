export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'

export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot'

export interface MapConfig {
  id: MapId
  scale: number
  origin_x: number
  origin_z: number
  image: string
}

export interface PlayerEvent {
  id: number
  user_id: string
  match_id: string
  map_id: MapId
  x: number
  z: number
  ts: number
  event_type: EventType
  is_bot: boolean
  pixel_x: number
  pixel_y: number
  date_label: string
}

export interface Match {
  match_id: string
  map_id: MapId
  date_label: string
  total_events: number
  human_count: number
  bot_count: number
  map_match_number: number
}

export interface Insight {
  id: number
  match_id: string | null
  map_id: MapId
  type: 'frustration_zone' | 'dead_zone' | 'choke_point' | 'hot_drop' | 'storm_cluster' | 'loot_black_hole' | 'combat_hotspot'
  severity: 'low' | 'medium' | 'high'
  description: string
  pixel_x1: number
  pixel_y1: number
  pixel_x2: number
  pixel_y2: number
}

export interface Region {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface HeatmapCell {
  pixel_x: number
  pixel_y: number
  count: number
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  overlay?: {
    type: string
    bounds: Region
    intensity: number
    label: string
  }
}

export interface AIAnnotation {
  id: string
  center_px: number
  center_py: number
  radius: number        // canvas-space (0–1024)
  label: string         // short pin label
  description: string   // full diagnosis shown on click
  category: 'dead_zone' | 'choke_point' | 'storm_cluster' | 'loot_density'
  color: string
}

export interface DesignerMemory {
  id: string
  designer_id: string
  map_id: string | null
  content: string
  source: 'chat' | 'annotation' | 'manual'
  created_at: string
}

export interface Designer {
  designer_id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface CustomKPI {
  id: string
  designer_id: string
  name: string
  description: string | null
  formula: string
  color: string
  created_at: string
}
