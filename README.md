# LILA BLACK

A game analytics visualiser built for level designers.

LILA BLACK helps designers understand *why* player behaviour happens on their maps and *what* to change in the level design to improve the player experience.

## Stack

- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js API routes (serverless)
- **Database:** Supabase (PostgreSQL + pgvector)
- **AI:** Claude Haiku via OpenRouter
- **Embeddings:** Transformers.js (runs locally, zero API cost)

## Features

- Interactive map viewer with zoom/pan, heatmap and paths mode
- Multi-match selection and timeline playback
- Region selection with world coordinate display
- AI assistant with streaming responses and agentic tool-calling
- AI memory system with semantic search (pgvector)
- Dead zone, choke point and storm cluster detection
- CSV upload for match data ingestion
- Custom KPI formula editor per designer

## Pipeline

The `pipeline/` folder contains the Python data ingestion scripts for processing raw event CSVs into Supabase.

```bash
cd pipeline
pip install -r requirements.txt
python ingest.py
```
