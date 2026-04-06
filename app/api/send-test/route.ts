import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, getStatus } from '@/lib/whatsapp'
import { buildMessage } from '@/lib/utils'
import * as db from '@/lib/db'

export async function POST(request: Request) {
  const { phone, name } = (await request.json()) as { phone?: string; name?: string }
  if (!phone?.trim()) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

  const { status } = getStatus()
  if (status !== 'connected') return NextResponse.json({ error: 'WhatsApp is not connected' }, { status: 400 })

  const settings = db.getSettings()
  const baseUrl = settings.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const message = buildMessage(settings.messageTemplate, {
    name: name?.trim() || 'שרה כהן',
    host_name: settings.hostName,
    date: settings.eventDate,
    time: settings.eventTime,
    location: settings.eventLocation,
    rsvp_link: `${baseUrl}/rsvp/preview`,
  })

  await sendWhatsAppMessage(phone.trim(), message)
  return NextResponse.json({ ok: true })
}
