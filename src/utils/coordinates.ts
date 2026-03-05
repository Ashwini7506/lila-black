import { MapConfig, MapId } from '@/types'

export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  AmbroseValley: {
    id: 'AmbroseValley',
    scale: 900,
    origin_x: -370,
    origin_z: -473,
    image: '/minimaps/AmbroseValley_Minimap.png',
  },
  GrandRift: {
    id: 'GrandRift',
    scale: 581,
    origin_x: -290,
    origin_z: -290,
    image: '/minimaps/GrandRift_Minimap.png',
  },
  Lockdown: {
    id: 'Lockdown',
    scale: 1000,
    origin_x: -500,
    origin_z: -500,
    image: '/minimaps/Lockdown_Minimap.jpg',
  },
}

export function worldToPixel(
  x: number,
  z: number,
  mapId: MapId,
  canvasSize = 1024
): { px: number; py: number } {
  const cfg = MAP_CONFIGS[mapId]
  const u = (x - cfg.origin_x) / cfg.scale
  const v = (z - cfg.origin_z) / cfg.scale
  return {
    px: u * canvasSize,
    py: (1 - v) * canvasSize, // Y axis is flipped
  }
}

export function pixelToWorld(
  px: number,
  py: number,
  mapId: MapId,
  canvasSize = 1024
): { x: number; z: number } {
  const cfg = MAP_CONFIGS[mapId]
  const u = px / canvasSize
  const v = 1 - py / canvasSize
  return {
    x: u * cfg.scale + cfg.origin_x,
    z: v * cfg.scale + cfg.origin_z,
  }
}
