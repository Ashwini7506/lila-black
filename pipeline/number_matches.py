"""
Assigns stable per-map match numbers to every row in the matches table.
Numbering is scoped per map (AmbroseValley #1-566, GrandRift #1-59, etc.)
Ordered by date first, then match_id alphabetically within each date.

Run once after adding the map_match_number column:
    python3 number_matches.py
"""
from __future__ import annotations
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MAPS = ['AmbroseValley', 'GrandRift', 'Lockdown']
DATE_ORDER = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14']


def run():
    for map_id in MAPS:
        res = supabase.table('matches') \
            .select('match_id, date_label') \
            .eq('map_id', map_id) \
            .execute()
        matches = res.data or []

        # Sort by date chronologically, then match_id alphabetically within each date
        matches.sort(key=lambda m: (
            DATE_ORDER.index(m['date_label']) if m['date_label'] in DATE_ORDER else 99,
            m['match_id']
        ))

        print(f"{map_id}: numbering {len(matches)} matches...")

        for i, match in enumerate(matches, 1):
            supabase.table('matches') \
                .update({'map_match_number': i}) \
                .eq('match_id', match['match_id']) \
                .execute()

        print(f"  → Done. {map_id} Match #1 = {matches[0]['match_id'][:16]}…")

    print("\nAll maps numbered.")


if __name__ == '__main__':
    run()
