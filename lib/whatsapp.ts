import { Client, LocalAuth } from 'whatsapp-web.js'
import { EventEmitter } from 'events'
import { existsSync, rmSync } from 'fs'
import path from 'path'
import { formatPhoneForWhatsApp } from './utils'

export type WAStatus = 'disconnected' | 'loading' | 'qr_pending' | 'connected'

declare global {
  // eslint-disable-next-line no-var
  var _waClient: Client | undefined
  // eslint-disable-next-line no-var
  var _waStatus: WAStatus
  // eslint-disable-next-line no-var
  var _waQR: string | undefined
  // eslint-disable-next-line no-var
  var _waPhone: string | undefined
  // eslint-disable-next-line no-var
  var _waError: string | undefined
  // eslint-disable-next-line no-var
  var _waEmitter: EventEmitter
}

if (!global._waEmitter) {
  global._waEmitter = new EventEmitter()
  global._waEmitter.setMaxListeners(100)
}
if (!global._waStatus) global._waStatus = 'disconnected'

export const waEmitter: EventEmitter = global._waEmitter

export function getStatus() {
  return {
    status: global._waStatus,
    phone:  global._waPhone,
    qr:     global._waQR,
    error:  global._waError,
  }
}

function getChromePath(): string | undefined {
  // 1. Explicit env var (set on Railway)
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    console.log('[WhatsApp] Using PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH)
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  // 2. Puppeteer's dedicated cached Chromium
  const puppeteerCache = path.join(process.env.HOME ?? '', '.cache', 'puppeteer', 'chrome')
  if (existsSync(puppeteerCache)) {
    try {
      const { readdirSync } = require('fs') as typeof import('fs')
      for (const version of readdirSync(puppeteerCache)) {
        const p = path.join(puppeteerCache, version, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
        const p2 = path.join(puppeteerCache, version, 'chrome-linux', 'chrome')
        if (existsSync(p))  { console.log('[WhatsApp] Using puppeteer cache:', p);  return p }
        if (existsSync(p2)) { console.log('[WhatsApp] Using puppeteer cache:', p2); return p2 }
      }
    } catch {}
  }
  // 3. System browsers (macOS + Linux)
  const candidates = [
    '/run/current-system/sw/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]
  const found = candidates.find(p => existsSync(p))
  if (found) console.log('[WhatsApp] Using system Chrome:', found)
  return found
}

function cleanStaleLocks() {
  const sessionDir = path.resolve(process.env.WA_SESSION_PATH ?? '.wwebjs_auth', 'session')
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    const p = path.join(sessionDir, f)
    try { if (existsSync(p)) { rmSync(p); console.log('[WhatsApp] Removed stale lock:', f) } } catch {}
  }
  // Remove LevelDB lock that gets stuck when Chrome exits uncleanly
  const leveldbLock = path.join(sessionDir, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb', 'LOCK')
  try { if (existsSync(leveldbLock)) { rmSync(leveldbLock); console.log('[WhatsApp] Removed stale LevelDB LOCK') } } catch {}
}

export async function initWhatsApp(): Promise<void> {
  if (global._waClient) return

  global._waStatus = 'loading'
  global._waError  = undefined
  waEmitter.emit('status', 'loading')

  cleanStaleLocks()

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: process.env.WA_SESSION_PATH ?? '.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      executablePath: getChromePath(),
      protocolTimeout: 180000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  })

  client.on('qr', (qr: string) => {
    console.log('[WhatsApp] QR code received')
    global._waStatus = 'qr_pending'
    global._waQR     = qr
    global._waError  = undefined
    waEmitter.emit('qr', qr)
    waEmitter.emit('status', 'qr_pending')
  })

  client.on('ready', () => {
    console.log('[WhatsApp] Ready! Phone:', (client.info as { wid?: { user?: string } })?.wid?.user)
    global._waStatus = 'connected'
    global._waQR     = undefined
    global._waError  = undefined
    global._waPhone  = (client.info as { wid?: { user?: string } })?.wid?.user
    waEmitter.emit('status', 'connected')
  })

  client.on('loading_screen', (percent: number, message: string) => {
    console.log(`[WhatsApp] Loading ${percent}% — ${message}`)
  })

  client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated')
  })

  client.on('disconnected', () => {
    global._waStatus = 'disconnected'
    global._waPhone  = undefined
    global._waQR     = undefined
    global._waClient = undefined
    waEmitter.emit('status', 'disconnected')
  })

  client.on('auth_failure', () => {
    global._waStatus = 'disconnected'
    global._waError  = 'Auth failed — נסי להתחבר שוב'
    global._waQR     = undefined
    global._waClient = undefined
    waEmitter.emit('status', 'disconnected')
  })

  global._waClient = client

  client.initialize().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WhatsApp] initialization error:', msg)
    global._waStatus = 'disconnected'
    global._waError  = msg
    global._waClient = undefined
    waEmitter.emit('status', 'disconnected')
  })
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  if (!global._waClient || global._waStatus !== 'connected') {
    throw new Error('WhatsApp is not connected')
  }
  const formatted = formatPhoneForWhatsApp(phone)
  await global._waClient.sendMessage(formatted, message)
}

export async function disconnectWhatsApp(): Promise<void> {
  if (global._waClient) {
    try { await global._waClient.destroy() } catch {}
  }
  global._waClient = undefined
  global._waStatus = 'disconnected'
  global._waPhone  = undefined
  global._waQR     = undefined
  global._waError  = undefined
  cleanStaleLocks()
  waEmitter.emit('status', 'disconnected')
}
