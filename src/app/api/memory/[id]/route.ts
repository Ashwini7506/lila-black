import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { designerId } = await req.json()

  if (!designerId) return NextResponse.json({ error: 'designerId required' }, { status: 400 })

  const admin = supabaseAdmin()

  // Verify ownership
  const { data: mem } = await admin
    .from('designer_memory')
    .select('designer_id')
    .eq('id', id)
    .single()

  if (!mem || mem.designer_id !== designerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin.from('designer_memory').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
