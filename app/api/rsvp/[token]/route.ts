import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const guest = db.findGuestByToken(params.token)
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(guest)
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const { status, partySize } = (await request.json()) as { status?: string; partySize?: number }
  if (status !== 'attending' && status !== 'not_attending') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const guest = db.findGuestByToken(params.token)
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = db.updateGuestRsvp(params.token, status, partySize)
  return NextResponse.json(updated)
}
