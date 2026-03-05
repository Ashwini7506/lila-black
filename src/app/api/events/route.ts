import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

const PAGE_SIZE = 1000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const match_ids = searchParams.get('match_ids')
  const match_id = searchParams.get('match_id')

  const ids = match_ids
    ? match_ids.split(',').filter(Boolean)
    : match_id ? [match_id] : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'match_id or match_ids is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const allRows: unknown[] = []
  let from = 0

  // Paginate through Supabase (server max_rows = 1000 per request)
  while (true) {
    const { data, error } = await admin
      .from('events')
      .select('*')
      .in('match_id', ids)
      .order('ts', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < PAGE_SIZE) break  // last page
    from += PAGE_SIZE
  }

  return NextResponse.json(allRows)
}
