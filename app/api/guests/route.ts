import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import * as db from '@/lib/db'
import { generateToken } from '@/lib/utils'

export async function GET() {
  const guests = db.findGuests()
  const total          = guests.length
  const attending      = guests.filter(g => g.rsvpStatus === 'attending').length
  const notAttending   = guests.filter(g => g.rsvpStatus === 'not_attending').length
  const pending        = guests.filter(g => !g.rsvpStatus).length
  const totalAttendees = guests.filter(g => g.rsvpStatus === 'attending').reduce((sum, g) => sum + (g.partySize ?? 1), 0)
  return NextResponse.json({ guests, stats: { total, attending, notAttending, pending, totalAttendees } })
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  // ── Single guest (JSON) ──────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const { name, phone } = (await request.json()) as { name?: string; phone?: string }
    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }
    const guest = db.createGuest(name.trim(), phone.trim(), generateToken())
    return NextResponse.json(guest, { status: 201 })
  }

  // ── Excel upload (multipart) ─────────────────────────────────────────────
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  if (!rows.length) return NextResponse.json({ error: 'Empty spreadsheet' }, { status: 400 })

  const NAME_KEYS  = ['name', 'שם', 'full name', 'שם מלא', 'guest', 'אורח']
  const PHONE_KEYS = ['phone', 'טלפון', 'נייד', 'phone number', 'מספר טלפון', 'mobile', 'cell', 'cellular']

  const rawKeys = Object.keys(rows[0])
  const nameKey  = rawKeys.find(k => NAME_KEYS.includes(k.toLowerCase().trim()))
  const phoneKey = rawKeys.find(k => PHONE_KEYS.includes(k.toLowerCase().trim()))

  if (!nameKey || !phoneKey) {
    return NextResponse.json(
      { error: `Could not detect columns. Found: ${rawKeys.join(', ')}` },
      { status: 400 }
    )
  }

  let added = 0, skipped = 0
  for (const row of rows) {
    const name  = String(row[nameKey] ?? '').trim()
    const phone = String(row[phoneKey] ?? '').trim()
    if (!name || !phone) { skipped++; continue }
    try {
      db.createGuest(name, phone, generateToken())
      added++
    } catch { skipped++ }
  }

  return NextResponse.json({ added, skipped })
}

export async function DELETE() {
  db.deleteAllGuests()
  return NextResponse.json({ ok: true })
}
