import { EventEmitter } from 'events'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { formatPhoneForWhatsApp } from './utils'

export type WAStatus = 'disconnected' | 'loading' | 'qr_pending' | 'connected'

declare global {
  // eslint-disable-next-line no-var
  var _waSocket: import('@whiskeysockets/baileys').WASocket | undefined
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

function getSessionPath() {
  return path.resolve(process.env.WA_SESSION_PATH ?? '.baileys_auth')
}

export async function initWhatsApp(): Promise<void> {
  if (global._waSocket) return

  global._waStatus = 'loading'
  global._waError  = undefined
  waEmitter.emit('status', 'loading')

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = await import('@whiskeysockets/baileys')
    const { Boom } = await import('@hapi/boom')
    const pino = (await import('pino')).default

    const sessionPath = getSessionPath()
    if (!existsSync(sessionPath)) mkdirSync(sessionPath, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Henna RSVP', 'Chrome', '1.0.0'],
    })

    global._waSocket = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log('[WhatsApp] QR code received')
        global._waStatus = 'qr_pending'
        global._waQR     = qr
        global._waError  = undefined
        waEmitter.emit('qr', qr)
        waEmitter.emit('status', 'qr_pending')
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0] ?? sock.user?.id
        console.log('[WhatsApp] Ready! Phone:', phone)
        global._waStatus = 'connected'
        global._waQR     = undefined
        global._waError  = undefined
        global._waPhone  = phone
        waEmitter.emit('status', 'connected')
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as InstanceType<typeof Boom>)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log('[WhatsApp] Connection closed. Status code:', statusCode, 'Reconnect:', shouldReconnect)

        global._waSocket = undefined
        global._waStatus = 'disconnected'
        global._waPhone  = undefined
        global._waQR     = undefined

        if (!shouldReconnect) {
          global._waError = 'Logged out — please reconnect'
          waEmitter.emit('status', 'disconnected')
        } else {
          // Auto-reconnect
          setTimeout(() => {
            console.log('[WhatsApp] Auto-reconnecting...')
            initWhatsApp().catch(console.error)
          }, 3000)
          waEmitter.emit('status', 'disconnected')
        }
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WhatsApp] initialization error:', msg)
    global._waStatus = 'disconnected'
    global._waError  = msg
    global._waSocket = undefined
    waEmitter.emit('status', 'disconnected')
  }
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  if (!global._waSocket || global._waStatus !== 'connected') {
    throw new Error('WhatsApp is not connected')
  }
  const formatted = formatPhoneForWhatsApp(phone)
  await global._waSocket.sendMessage(formatted, { text: message })
}

export async function disconnectWhatsApp(): Promise<void> {
  if (global._waSocket) {
    try { await global._waSocket.logout() } catch {}
    try { await global._waSocket.end(undefined) } catch {}
  }
  global._waSocket = undefined
  global._waStatus = 'disconnected'
  global._waPhone  = undefined
  global._waQR     = undefined
  global._waError  = undefined
  waEmitter.emit('status', 'disconnected')
}
