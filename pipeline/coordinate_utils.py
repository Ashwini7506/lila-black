MAP_CONFIGS = {
    "AmbroseValley": {"scale": 900,  "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581,  "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

CANVAS_SIZE = 1024

def world_to_pixel(x: float, z: float, map_id: str) -> tuple[float, float]:
    cfg = MAP_CONFIGS[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    pixel_x = u * CANVAS_SIZE
    pixel_y = (1 - v) * CANVAS_SIZE  # Y axis is flipped
    return pixel_x, pixel_y
