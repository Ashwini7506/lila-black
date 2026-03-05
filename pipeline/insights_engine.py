"""
Map-level insights engine.
Aggregates patterns across ALL matches for a map to surface consistent design problems.
One insight = a pattern that repeats across many matches, not a single match event.
"""
import pandas as pd

CANVAS_SIZE = 1024
GRID_SIZE   = 8                # 8×8 grid → each cell is 128×128 canvas pixels
CELL_SIZE   = CANVAS_SIZE / GRID_SIZE

DEATH_TYPES  = ['Killed', 'BotKilled', 'KilledByStorm']
KILL_TYPES   = ['Kill', 'BotKill']
POS_TYPES    = ['Position', 'BotPosition']


def _cell(col: int, row: int) -> dict:
    return {
        'pixel_x1': col * CELL_SIZE,
        'pixel_y1': row * CELL_SIZE,
        'pixel_x2': (col + 1) * CELL_SIZE,
        'pixel_y2': (row + 1) * CELL_SIZE,
    }


def _severity(freq: float, mid: float = 0.50, high: float = 0.70) -> str:
    if freq >= high:   return 'high'
    if freq >= mid:    return 'medium'
    return 'low'


def compute_map_insights(all_df: pd.DataFrame, map_id: str) -> list[dict]:
    """
    Takes ALL events for a single map (across all matches/dates).
    Returns a list of map-level insight dicts (match_id=None).
    """
    insights = []

    all_matches    = all_df['match_id'].unique()
    total_matches  = len(all_matches)
    if total_matches == 0:
        return insights

    # ── Assign grid cells ────────────────────────────────────────────────────
    df = all_df.copy()
    df['col'] = (df['pixel_x'] // CELL_SIZE).clip(0, GRID_SIZE - 1).astype(int)
    df['row'] = (df['pixel_y'] // CELL_SIZE).clip(0, GRID_SIZE - 1).astype(int)

    death_df  = df[df['event_type'].isin(DEATH_TYPES)]
    kill_df   = df[df['event_type'].isin(KILL_TYPES)]
    storm_df  = df[df['event_type'] == 'KilledByStorm']
    loot_df   = df[df['event_type'] == 'Loot']
    pos_df    = df[df['event_type'].isin(POS_TYPES)]

    def make_insight(type_, severity, desc, col, row):
        return {
            'map_id':   map_id,
            'match_id': None,
            'type':     type_,
            'severity': severity,
            'description': desc,
            **_cell(col, row),
        }

    # ── 1. FRUSTRATION ZONES ─────────────────────────────────────────────────
    # Cells where players die but never deal damage in the same area.
    cell_frustration: dict[tuple, int] = {}
    for match_id, mdf in df.groupby('match_id'):
        kill_cells = set(zip(
            mdf[mdf['event_type'].isin(KILL_TYPES)]['col'],
            mdf[mdf['event_type'].isin(KILL_TYPES)]['row']
        ))
        death_cells = set(zip(
            mdf[mdf['event_type'].isin(DEATH_TYPES)]['col'],
            mdf[mdf['event_type'].isin(DEATH_TYPES)]['row']
        ))
        for cell in death_cells:
            # No kills in this cell or any adjacent cell
            adjacent = {(cell[0]+dx, cell[1]+dy) for dx in [-1,0,1] for dy in [-1,0,1]}
            if not adjacent & kill_cells:
                cell_frustration[cell] = cell_frustration.get(cell, 0) + 1

    for (col, row), count in cell_frustration.items():
        freq = count / total_matches
        if freq >= 0.05:
            insights.append(make_insight(
                'frustration_zone',
                _severity(freq, 0.15, 0.30),
                f'Players dying without dealing damage — {count}/{total_matches} matches ({freq:.0%}). '
                f'Likely unfair sightline, cover gap, or bot dominance.',
                col, row
            ))

    # ── 2. CHOKE POINTS ──────────────────────────────────────────────────────
    # Cells in top 5% traffic per match, consistently across matches.
    cell_choke: dict[tuple, int] = {}
    for match_id, mdf in df.groupby('match_id'):
        mp = mdf[mdf['event_type'].isin(POS_TYPES)]
        if len(mp) == 0:
            continue
        traffic = mp.groupby(['col', 'row']).size()
        threshold = traffic.quantile(0.95)
        for (col, row) in traffic[traffic >= threshold].index:
            cell_choke[(col, row)] = cell_choke.get((col, row), 0) + 1

    for (col, row), count in cell_choke.items():
        freq = count / total_matches
        if freq >= 0.15:
            insights.append(make_insight(
                'choke_point',
                _severity(freq, 0.25, 0.45),
                f'Top 5% traffic density in {count}/{total_matches} matches ({freq:.0%}). '
                f'Consistent bottleneck — consider opening alternate routes.',
                col, row
            ))

    # ── 3. DEAD ZONES ────────────────────────────────────────────────────────
    # Cells visited by very few matches — players are ignoring the area.
    if len(pos_df) > 0:
        cell_visits = pos_df.groupby(['col', 'row'])['match_id'].nunique()
        for col in range(GRID_SIZE):
            for row in range(GRID_SIZE):
                count = int(cell_visits.get((col, row), 0))
                freq  = count / total_matches
                if freq < 0.05:
                    insights.append(make_insight(
                        'dead_zone',
                        'medium' if freq < 0.02 else 'low',
                        f'Only {count}/{total_matches} matches ({freq:.0%}) visited this area. '
                        f'Players are consistently avoiding it — needs more draw (loot, cover, objectives).',
                        col, row
                    ))

    # ── 4. HOT DROP ZONES ────────────────────────────────────────────────────
    # High kill density in the first 20% of match time — contested landing spots.
    cell_hotdrop: dict[tuple, int] = {}
    for match_id, mdf in df.groupby('match_id'):
        mkills = mdf[mdf['event_type'].isin(KILL_TYPES)]
        if len(mkills) == 0:
            continue
        duration = mdf['ts'].max() - mdf['ts'].min()
        if duration == 0:
            continue
        early_cutoff = mdf['ts'].min() + duration * 0.20
        early_kills  = mkills[mkills['ts'] <= early_cutoff]
        for cell in set(zip(early_kills['col'], early_kills['row'])):
            cell_hotdrop[cell] = cell_hotdrop.get(cell, 0) + 1

    for (col, row), count in cell_hotdrop.items():
        freq = count / total_matches
        if freq >= 0.05:
            insights.append(make_insight(
                'hot_drop',
                _severity(freq, 0.15, 0.30),
                f'High kill density in first 20% of match in {count}/{total_matches} matches ({freq:.0%}). '
                f'Hot landing zone — players fight immediately on arrival.',
                col, row
            ))

    # ── 5. STORM DEATH CLUSTERS ──────────────────────────────────────────────
    # Where the storm consistently kills players — timing or path may be unfair.
    if len(storm_df) > 0:
        cell_storm = storm_df.groupby(['col', 'row'])['match_id'].nunique()
        for (col, row), count in cell_storm.items():
            freq = count / total_matches
            if freq >= 0.03:
                insights.append(make_insight(
                    'storm_cluster',
                    _severity(freq, 0.10, 0.25),
                    f'Storm kills concentrated here in {count}/{total_matches} matches ({freq:.0%}). '
                    f'Safe zone path may be blocked or storm timing unfair in this area.',
                    col, row
                ))

    # ── 6. LOOT BLACK HOLES ──────────────────────────────────────────────────
    # Areas players pass through but never loot — loot is either absent or skipped.
    if len(loot_df) > 0 and len(pos_df) > 0:
        loot_cells    = loot_df.groupby(['col', 'row'])['match_id'].nunique()
        traffic_cells = pos_df.groupby(['col', 'row'])['match_id'].nunique()
        for (col, row), traffic_count in traffic_cells.items():
            traffic_freq = traffic_count / total_matches
            if traffic_freq < 0.30:
                continue   # too rarely visited to be meaningful
            loot_count = int(loot_cells.get((col, row), 0))
            loot_freq  = loot_count / total_matches
            if loot_freq < 0.10:
                insights.append(make_insight(
                    'loot_black_hole',
                    'low',
                    f'Players pass through ({traffic_count}/{total_matches} matches, {traffic_freq:.0%}) '
                    f'but rarely loot here ({loot_count}/{total_matches}, {loot_freq:.0%}). '
                    f'Consider loot density or visibility.',
                    col, row
                ))

    # ── 7. COMBAT HOT SPOTS ──────────────────────────────────────────────────
    # Cells with both kills AND deaths consistently — fair, intense combat zones.
    cell_combat: dict[tuple, int] = {}
    for match_id, mdf in df.groupby('match_id'):
        kill_cells  = set(zip(mdf[mdf['event_type'].isin(KILL_TYPES)]['col'],
                              mdf[mdf['event_type'].isin(KILL_TYPES)]['row']))
        death_cells = set(zip(mdf[mdf['event_type'].isin(DEATH_TYPES)]['col'],
                              mdf[mdf['event_type'].isin(DEATH_TYPES)]['row']))
        for cell in kill_cells & death_cells:   # both kills AND deaths
            cell_combat[cell] = cell_combat.get(cell, 0) + 1

    for (col, row), count in cell_combat.items():
        freq = count / total_matches
        if freq >= 0.05:
            insights.append(make_insight(
                'combat_hotspot',
                _severity(freq, 0.15, 0.30),
                f'Two-sided combat in {count}/{total_matches} matches ({freq:.0%}). '
                f'High-engagement zone with balanced kills and deaths — is this placement intentional?',
                col, row
            ))

    from collections import Counter
    breakdown = Counter(i['type'] for i in insights)
    print(f'  [{map_id}] {total_matches} matches → {len(insights)} insights: {dict(breakdown)}')
    return insights
