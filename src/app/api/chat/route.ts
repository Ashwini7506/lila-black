import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { queryEvents, aggregateEvents, getMatchSummary, compareDateLabels } from '@/utils/aiTools'
import { generateEmbedding, vectorToString } from '@/utils/embeddings'
import { supabaseAdmin } from '@/utils/supabase'
import { Region, MapId } from '@/types'
import { pixelToWorld } from '@/utils/coordinates'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODEL = 'anthropic/claude-haiku-4-5'

const TOOL_STATUS: Record<string, string> = {
  query_events:        'Querying events...',
  aggregate_events:    'Aggregating data...',
  get_match_summary:   'Loading match summary...',
  compare_date_labels: 'Comparing date periods...',
}

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_events',
      description: `Fetch raw event rows so you can reason over them directly.
Use when you need to inspect sequences, find first/last events per player, or examine individual events.
Spawn point = first Position event per (match_id, user_id) sorted by ts ascending.
Available event_types: Position, BotPosition, Kill, Killed, BotKill, BotKilled, KilledByStorm, Loot`,
      parameters: {
        type: 'object',
        properties: {
          event_types: { type: 'array', items: { type: 'string' }, description: 'Filter by event type. Omit for all types.' },
          region:      { type: 'object', description: 'Optional pixel bounds {x1,y1,x2,y2} 0-1024', properties: { x1:{type:'number'}, y1:{type:'number'}, x2:{type:'number'}, y2:{type:'number'} } },
          sort_by:     { type: 'string', enum: ['ts_asc', 'ts_desc'], description: 'Sort by timestamp. Use ts_asc to find earliest events (spawns).' },
          limit:       { type: 'number', description: 'Max rows to return (default 200, max 300).' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aggregate_events',
      description: `Count and group events. More efficient than query_events for statistics.
group_by options:
- "event_type"    → counts per event type (Kill, Killed, etc.)
- "user_id"       → unique player counts (humans vs bots)
- "match_id"      → per-match breakdown
- "is_bot"        → human vs bot event split
- "first_per_user"→ spawn analysis: finds first Position event per player per match, checks how many are in the region. Returns human_spawns, bot_spawns, matches_first_spawn_was_human, matches_first_spawn_was_bot. Use this for ALL spawn questions including "which matches started by human vs bot"
- "grid_8x8"      → 8×8 spatial heatmap with world coords per cell
- "grid_16x16"    → finer 16×16 spatial heatmap`,
      parameters: {
        type: 'object',
        properties: {
          event_types: { type: 'array', items: { type: 'string' }, description: 'Filter by event type. Omit for all types.' },
          region:      { type: 'object', description: 'Optional pixel bounds {x1,y1,x2,y2} 0-1024', properties: { x1:{type:'number'}, y1:{type:'number'}, x2:{type:'number'}, y2:{type:'number'} } },
          group_by:    { type: 'string', description: 'How to group: event_type | user_id | match_id | is_bot | first_per_user | grid_8x8 | grid_16x16' },
        },
        required: ['group_by'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_match_summary',
      description: 'Get metadata for selected matches (total events, human count, bot count, date labels). Use as baseline context before analysis.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_date_labels',
      description: 'Compare match stats between two date labels (e.g. patch impact analysis). Shows how player counts and event volumes changed between two periods.',
      parameters: {
        type: 'object',
        properties: {
          date1: { type: 'string', description: 'e.g. February_10' },
          date2: { type: 'string', description: 'e.g. February_17' },
        },
        required: ['date1', 'date2'],
      },
    },
  },
]

const encoder = new TextEncoder()

export async function POST(req: NextRequest) {
  const { message, matchIds, mapId, selectedRegion, designerId, history } = await req.json() as {
    message: string
    matchIds: string[]
    mapId: MapId
    selectedRegion: Region | null
    designerId: string | null
    history: OpenAI.Chat.ChatCompletionMessageParam[]
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (obj: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

        try {
          // 1. Retrieve relevant memories
          let memoriesCtx = ''
          if (designerId && message) {
            send({ type: 'status', text: 'Recalling past observations...' })
            try {
              const memRes = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/memory?designerId=${designerId}&mapId=${mapId}&query=${encodeURIComponent(message)}`,
                { headers: { 'x-internal': '1' } }
              )
              if (memRes.ok) {
                const mems = await memRes.json() as { content: string; source: string }[]
                if (mems.length > 0) {
                  memoriesCtx = '\n\nRelevant past observations:\n' +
                    mems.map((m, i) => `${i + 1}. [${m.source}] ${m.content}`).join('\n')
                }
              }
            } catch { /* memory retrieval is non-critical */ }
          }

          // 2. Build region context with world coords
          let regionCtx = 'none (full map)'
          if (selectedRegion) {
            const tl = pixelToWorld(selectedRegion.x1, selectedRegion.y1, mapId)
            const br = pixelToWorld(selectedRegion.x2, selectedRegion.y2, mapId)
            regionCtx = `pixel bounds x1=${Math.round(selectedRegion.x1)} y1=${Math.round(selectedRegion.y1)} x2=${Math.round(selectedRegion.x2)} y2=${Math.round(selectedRegion.y2)} | world: TL(${Math.round(tl.x)},${Math.round(tl.z)}) BR(${Math.round(br.x)},${Math.round(br.z)})`
          }

          // 3. Build system prompt
          const systemPrompt = `You are an AI analyst embedded in LILA BLACK — a game analytics tool for level designers.
Your role: help designers understand WHY player behavior happens and WHAT to change in the map.

Current context:
- Map: ${mapId}
- Selected matches: ${matchIds.length > 0 ? matchIds.length + ' match(es)' : 'none'}
- Selected region: ${regionCtx}

Data schema (events table):
- event_type: "Position" | "BotPosition" | "Kill" | "Killed" | "BotKill" | "BotKilled" | "KilledByStorm" | "Loot"
- user_id: player UUID (same player across matches)
- match_id: which match this event belongs to
- ts: unix timestamp — LOWER ts = earlier in the match. First Position event per (match_id, user_id) = that player's spawn point
- pixel_x, pixel_y: canvas coords 0–1024
- is_bot: true = bot, false = human player
- Kill/Killed = PvP. BotKill/BotKilled = bot combat. KilledByStorm = storm death

Key reasoning patterns:
- Spawn locations → aggregate_events(["Position","BotPosition"], region, "first_per_user")
- Death causes → aggregate_events(["Kill","Killed","BotKill","BotKilled","KilledByStorm"], region, "event_type")
- Traffic/routing → aggregate_events(["Position"], region, "user_id")
- Spatial heatmap → aggregate_events([], region, "grid_8x8")
- Per-match breakdown → aggregate_events([], null, "match_id")
- Raw sequence inspection → query_events(types, region, "ts_asc", 200)
${memoriesCtx}

Response format:
FINDING: [one sentence — what the data shows]
DIAGNOSIS: [why players made this decision — think in terms of risk/reward, routing, sight lines, cover]
FIX: [one specific, spatial, actionable level design change]

Hard rules:
- NEVER show raw UUIDs, match_ids, user_ids, or unix timestamps in your response — these are meaningless to designers
- Always summarize into counts, ratios, and plain language (e.g. "12 matches", "28 humans", not a list of IDs)
- Use world coordinates (x, z) when referencing locations
- Talk like a senior playtest analyst, not a data dump`

          const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...(history ?? []).filter(m => m.role !== 'system'),
            { role: 'user', content: message },
          ]

          // 4. Agentic tool-calling loop
          let response = await client.chat.completions.create({
            model: MODEL,
            messages: conversationMessages,
            tools,
            tool_choice: 'auto',
          })

          let reply = response.choices[0].message

          while (reply.tool_calls && reply.tool_calls.length > 0) {
            conversationMessages.push(reply)

            for (const tc of reply.tool_calls) {
              if (tc.type !== 'function') continue
              const input = JSON.parse(tc.function.arguments) as Record<string, unknown>

              send({ type: 'status', text: TOOL_STATUS[tc.function.name] ?? 'Working...' })

              let result: unknown = { error: 'No matches selected' }
              if (matchIds.length > 0) {
                const region = (input.region as Region) ?? selectedRegion ?? null
                switch (tc.function.name) {
                  case 'query_events':
                    result = await queryEvents(
                      matchIds,
                      (input.event_types as string[] | null) ?? null,
                      region,
                      (input.sort_by as 'ts_asc' | 'ts_desc' | null) ?? null,
                      (input.limit as number) ?? 200
                    )
                    break
                  case 'aggregate_events':
                    result = await aggregateEvents(
                      matchIds,
                      (input.event_types as string[] | null) ?? null,
                      region,
                      input.group_by as string,
                      mapId
                    )
                    break
                  case 'get_match_summary':
                    result = await getMatchSummary(matchIds)
                    break
                  case 'compare_date_labels':
                    result = await compareDateLabels(mapId, input.date1 as string, input.date2 as string)
                    break
                }
              }

              conversationMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              })
            }

            response = await client.chat.completions.create({
              model: MODEL,
              messages: conversationMessages,
              tools,
              tool_choice: 'auto',
            })
            reply = response.choices[0].message
          }

          // 5. Push final reply to history
          if (reply.content) {
            conversationMessages.push({ role: 'assistant', content: reply.content })
          }

          // 6. Stream the response token by token
          send({ type: 'status', text: '' })
          if (reply.content) {
            const words = reply.content.split(' ')
            for (const word of words) {
              send({ type: 'token', content: word + ' ' })
              await new Promise(r => setTimeout(r, 8))
            }
          } else {
            const fallback = await client.chat.completions.create({
              model: MODEL, messages: conversationMessages, stream: true,
            })
            for await (const chunk of fallback) {
              const content = chunk.choices[0]?.delta?.content
              if (content) send({ type: 'token', content })
            }
          }

          // 7. Save significant finding to memory
          const finalContent = reply.content ?? ''
          if (finalContent.length > 150 && designerId) {
            try {
              const embedding = await generateEmbedding(finalContent.slice(0, 500))
              const admin = supabaseAdmin()
              await admin.from('designer_memory').insert({
                designer_id: designerId,
                map_id: mapId ?? null,
                content: finalContent.slice(0, 600),
                source: 'chat',
                embedding: vectorToString(embedding),
              })
            } catch { /* memory save is non-critical */ }
          }

          send({ type: 'done', history: conversationMessages })
        } catch (e) {
          send({ type: 'error', message: String(e) })
        } finally {
          controller.close()
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  )
}
