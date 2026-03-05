"""
Standalone script to recompute map-level insights from already-ingested events.
Run this instead of re-running ingest.py (which would duplicate events).

Usage:
    python run_insights.py
"""
from __future__ import annotations
import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client
from insights_engine import compute_map_insights

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BATCH_SIZE   = 500
PAGE_SIZE    = 1000

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MAPS = ['AmbroseValley', 'GrandRift', 'Lockdown']


def fetch_all_events(map_id: str) -> pd.DataFrame:
    """Paginate through the events table for a given map."""
    print(f"  Fetching events for {map_id}...")
    rows = []
    offset = 0
    while True:
        res = (
            supabase.table('events')
            .select('match_id, map_id, pixel_x, pixel_y, ts, event_type, is_bot, user_id')
            .eq('map_id', map_id)
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    print(f"    → {len(rows)} events")
    return pd.DataFrame(rows) if rows else pd.DataFrame()


def run():
    print("Recomputing map-level insights...\n")

    for map_id in MAPS:
        df = fetch_all_events(map_id)
        if df.empty:
            print(f"  No events for {map_id}, skipping\n")
            continue

        # Delete old insights for this map
        supabase.table('insights').delete().eq('map_id', map_id).execute()
        print(f"  Cleared old insights for {map_id}")

        # Compute new map-level insights
        insights = compute_map_insights(df, map_id)
        if not insights:
            print(f"  No insights generated for {map_id}\n")
            continue

        # Insert in batches
        for i in range(0, len(insights), BATCH_SIZE):
            supabase.table('insights').insert(insights[i:i + BATCH_SIZE]).execute()
        print(f"  Inserted {len(insights)} insights for {map_id}\n")

    print("Done.")


if __name__ == "__main__":
    run()
