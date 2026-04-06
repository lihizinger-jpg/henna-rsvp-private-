import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = db.deleteGuest(params.id)
  if (!ok) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
