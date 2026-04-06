import { NextResponse } from 'next/server'
import { getStatus, initWhatsApp } from '@/lib/whatsapp'

export async function POST() {
  const { status } = getStatus()
  if (status !== 'disconnected') {
    return NextResponse.json({ message: 'Already connecting or connected' })
  }
  // Fire-and-forget — do NOT await; status updates come via polling /api/whatsapp/status
  initWhatsApp()
  return NextResponse.json({ message: 'Connecting…' })
}
