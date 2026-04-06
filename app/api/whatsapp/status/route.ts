export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getStatus } from '@/lib/whatsapp'

export async function GET() {
  const { status, phone, qr, error } = getStatus()

  let qrImage: string | null = null
  if (qr) {
    try {
      qrImage = await QRCode.toDataURL(qr, { width: 280, margin: 2, color: { dark: '#3d1208', light: '#fdf6e3' } })
    } catch {
      qrImage = null
    }
  }

  return NextResponse.json({ status, phone, qrImage, error })
}
