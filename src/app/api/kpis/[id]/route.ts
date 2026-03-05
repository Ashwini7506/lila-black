import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

async function getVerifiedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const admin = supabaseAdmin()
  const { data: { user } } = await admin.auth.getUser(token)
  return user ?? null
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getVerifiedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = supabaseAdmin()

  // Verify ownership before deleting
  const { data: kpi } = await admin
    .from('custom_kpis')
    .select('designer_id')
    .eq('id', id)
    .single()

  if (!kpi || kpi.designer_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin.from('custom_kpis').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
