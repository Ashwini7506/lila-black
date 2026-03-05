import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { generateEmbedding, cosineSimilarity, parseVector, vectorToString } from '@/utils/embeddings'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const designerId = searchParams.get('designerId')
  const mapId      = searchParams.get('mapId')
  const query      = searchParams.get('query')

  if (!designerId) return NextResponse.json([])

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('designer_memory')
    .select('id, content, source, map_id, created_at, embedding')
    .eq('designer_id', designerId)
    .order('created_at', { ascending: false })

  if (error || !data || data.length === 0) return NextResponse.json([])

  // Filter to current map (include cross-map entries with null map_id)
  const relevant = mapId
    ? data.filter(m => !m.map_id || m.map_id === mapId)
    : data

  if (!query) {
    return NextResponse.json(relevant.slice(0, 20).map(({ embedding: _, ...rest }) => rest))
  }

  // Semantic search: score by cosine similarity
  const queryEmb = await generateEmbedding(query)
  const scored = relevant
    .map(m => ({
      id: m.id,
      content: m.content,
      source: m.source,
      map_id: m.map_id,
      created_at: m.created_at,
      similarity: m.embedding ? cosineSimilarity(queryEmb, parseVector(m.embedding) ?? []) : 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)

  return NextResponse.json(scored)
}

export async function POST(req: NextRequest) {
  const { designerId, mapId, content, source } = await req.json()

  if (!designerId || !content) {
    return NextResponse.json({ error: 'designerId and content required' }, { status: 400 })
  }

  const embedding = await generateEmbedding(content.slice(0, 500))
  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('designer_memory')
    .insert({
      designer_id: designerId,
      map_id: mapId ?? null,
      content,
      source: source ?? 'chat',
      embedding: vectorToString(embedding),
    })
    .select('id, content, source, map_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
