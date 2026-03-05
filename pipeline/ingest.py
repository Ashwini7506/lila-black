from __future__ import annotations
import os
import pyarrow.parquet as pq
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client
from coordinate_utils import world_to_pixel
from bot_detector import is_human
from event_decoder import decode_event
from insights_engine import compute_map_insights

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PLAYER_DATA_PATH = os.environ.get("PLAYER_DATA_PATH", "../player_data")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

BATCH_SIZE = 500  # rows per Supabase insert


def load_file(filepath: str, date_label: str) -> pd.DataFrame | None:
    try:
        table = pq.read_table(filepath)
        df = table.to_pandas()
    except Exception as e:
        print(f"  Skipping {filepath}: {e}")
        return None

    # Decode event bytes → string
    df['event_type'] = df['event'].apply(decode_event)
    df.drop(columns=['event'], inplace=True)

    # Bot detection
    df['is_bot'] = df['user_id'].apply(lambda uid: not is_human(uid))

    # Map pixel coordinates (use x and z, ignore y which is elevation)
    map_id = df['map_id'].iloc[0] if len(df) > 0 else None
    if map_id not in ['AmbroseValley', 'GrandRift', 'Lockdown']:
        print(f"  Unknown map_id: {map_id}, skipping")
        return None

    pixels = df.apply(
        lambda row: world_to_pixel(row['x'], row['z'], row['map_id']), axis=1
    )
    df['pixel_x'] = pixels.apply(lambda p: p[0])
    df['pixel_y'] = pixels.apply(lambda p: p[1])

    # Timestamp: convert to ms int
    df['ts'] = pd.to_numeric(df['ts'], errors='coerce').fillna(0).astype(int)

    df['date_label'] = date_label

    # Clean up columns
    df = df.rename(columns={'match_id': 'match_id'})
    df['match_id'] = df['match_id'].str.replace('.nakama-0', '', regex=False)

    return df[[
        'user_id', 'match_id', 'map_id', 'x', 'z',
        'ts', 'event_type', 'is_bot', 'pixel_x', 'pixel_y', 'date_label'
    ]]


def upsert_matches(df: pd.DataFrame):
    def agg_match(g):
        return pd.Series({
            'map_id': g['map_id'].iloc[0],
            'date_label': g['date_label'].iloc[0],
            'total_events': len(g),
            'human_count': g.loc[~g['is_bot'], 'user_id'].nunique(),
            'bot_count': g.loc[g['is_bot'], 'user_id'].nunique(),
        })
    matches = df.groupby('match_id').apply(agg_match).reset_index()
    records = matches.to_dict(orient='records')
    supabase.table('matches').upsert(records, on_conflict='match_id').execute()
    print(f"  Upserted {len(records)} matches")


def insert_events(df: pd.DataFrame):
    records = df.to_dict(orient='records')
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        supabase.table('events').insert(batch).execute()
    print(f"  Inserted {len(records)} events")


def insert_map_insights(map_df: pd.DataFrame, map_id: str):
    # Clear existing insights for this map before reinserting
    supabase.table('insights').delete().eq('map_id', map_id).execute()

    insights = compute_map_insights(map_df, map_id)
    if not insights:
        return
    for i in range(0, len(insights), BATCH_SIZE):
        batch = insights[i:i + BATCH_SIZE]
        supabase.table('insights').insert(batch).execute()
    print(f"  Inserted {len(insights)} map-level insights for {map_id}")


def run():
    print("Starting ingestion...")

    all_frames = []  # collect everything for map-level insights at the end

    for day in DAYS:
        folder = os.path.join(PLAYER_DATA_PATH, day)
        if not os.path.exists(folder):
            print(f"Folder not found: {folder}, skipping")
            continue

        print(f"\nProcessing {day}...")
        day_frames = []

        for fname in os.listdir(folder):
            df = load_file(os.path.join(folder, fname), day)
            if df is not None and len(df) > 0:
                day_frames.append(df)

        if not day_frames:
            print(f"  No valid files in {day}")
            continue

        day_df = pd.concat(day_frames, ignore_index=True)
        print(f"  Loaded {len(day_df)} rows from {len(day_frames)} files")

        upsert_matches(day_df)
        insert_events(day_df)
        all_frames.append(day_df)

    # ── Map-level insights (cross-match, cross-date) ──────────────────────────
    if all_frames:
        print("\nComputing map-level insights...")
        all_df = pd.concat(all_frames, ignore_index=True)
        for map_id, map_df in all_df.groupby('map_id'):
            insert_map_insights(map_df, map_id)

    print("\nIngestion complete.")


if __name__ == "__main__":
    run()
