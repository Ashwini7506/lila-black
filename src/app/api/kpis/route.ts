import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

async function getVerifiedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = supabaseAdmin()
  const { data: { user } } = await admin.auth.getUser(token)
  return user ?? null
}

export async function GET(req: NextRequest) {
  const user = await getVerifiedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('custom_kpis')
    .select('*')
    .eq('designer_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getVerifiedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, formula, color } = body

  if (!name || !formula) {
    return NextResponse.json({ error: 'name and formula are required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('custom_kpis')
    .insert({
      designer_id: user.id,
      name,
      description: description ?? null,
      formula,
      color: color ?? '#60A5FA',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
