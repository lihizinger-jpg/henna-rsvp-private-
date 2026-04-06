import { NextResponse } from 'next/server'
import * as db from '@/lib/db'

export async function GET() {
  const settings = db.getSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Record<string, string>
  const settings = db.updateSettings(body)
  return NextResponse.json(settings)
}
