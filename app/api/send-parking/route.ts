import { NextResponse } from 'next/server'
import * as db from '@/lib/db'
import { sendWhatsAppMessage, getStatus } from '@/lib/whatsapp'

const PARKING_MESSAGE = `היי {name}! 🌿✨
אנחנו מתרגשים לפגוש אתכם הערב! 🎉💃
האירוע מתחיל בשעה 19:00 ⏰
לנוחיותכם יש חניון ברחוב שלמה 4 (חצרות יפו) 🅿️
בכניסה לאולם תקבלו מדבקת הנחה של 40 ש״ח לכרטיס החניה ✔️
החניון נמצא כ-5 דקות הליכה מהמקום 🚶‍♀️
מחכים לראות אתכם! 🩷`

export async function POST() {
  const { status } = getStatus()
  if (status !== 'connected') {
    return NextResponse.json({ error: 'WhatsApp is not connected' }, { status: 400 })
  }

  const guests = db.findGuests().filter(g => g.rsvpStatus === 'attending' && !g.parkingMessageSent)
  const results: { name: string; success: boolean; error?: string }[] = []

  for (const guest of guests) {
    try {
      const message = PARKING_MESSAGE.replace('{name}', guest.name)
      await sendWhatsAppMessage(guest.phone, message)
      db.markParkingMessageSent(guest.id)
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
