import { NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { sendWhatsAppMessage, getStatus } from '@/lib/whatsapp'
import { buildMessage } from '@/lib/utils'

export async function POST(request: Request) {
  const { onlyPending = true } = ((await request.json().catch(() => ({}))) as { onlyPending?: boolean })

  const { status } = getStatus()
  if (status !== 'connected') {
    return NextResponse.json({ error: 'WhatsApp is not connected' }, { status: 400 })
  }

  const settings = db.getSettings()
  const baseUrl = settings.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const guests = onlyPending ? db.findUnsentGuests() : db.findGuests()

  const results: { name: string; success: boolean; error?: string }[] = []

  for (const guest of guests) {
    try {
      const message = buildMessage(settings.messageTemplate, {
        name: guest.name,
        host_name: settings.hostName,
        date: settings.eventDate,
        time: settings.eventTime,
        location: settings.eventLocation,
        rsvp_link: `${baseUrl}/rsvp/${guest.token}`,
      })
      await sendWhatsAppMessage(guest.phone, message)
      db.markMessageSent(guest.id)
      results.push({ name: guest.name, success: true })
      await new Promise(r => setTimeout(r, 1200))
    } catch (err) {
      results.push({ name: guest.name, success: false, error: String(err) })
    }
  }

  return NextResponse.json({
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  })
}
