import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const map_id = searchParams.get('map_id')

  if (!map_id) return NextResponse.json({ error: 'map_id is required' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('insights')
    .select('*')
    .eq('map_id', map_id)
    .order('severity', { ascending: false })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
