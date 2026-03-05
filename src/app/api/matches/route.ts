import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const map_id = searchParams.get('map_id')
  const date = searchParams.get('date')

  const admin = supabaseAdmin()
  let query = admin.from('matches').select('*').order('map_match_number')

  if (map_id) query = query.eq('map_id', map_id)
  if (date) query = query.eq('date_label', date)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
