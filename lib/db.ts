// Database layer using Node's built-in sqlite (Node 22+, no binary downloads needed).
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'crypto'

const DB_PATH = (process.env.DATABASE_URL ?? 'file:./dev.db').replace(/^file:/, '')

declare global {
  // eslint-disable-next-line no-var
  var _db: DatabaseSync | undefined
}

function getDb(): DatabaseSync {
  if (!global._db) {
    global._db = new DatabaseSync(DB_PATH)
    migrate(global._db)
  }
  return global._db
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Guest (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      phone         TEXT NOT NULL,
      token         TEXT NOT NULL UNIQUE,
      rsvpStatus    TEXT,
      rsvpAt        TEXT,
      partySize     INTEGER,
      messageSent   INTEGER NOT NULL DEFAULT 0,
      messageSentAt TEXT,
      createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS Settings (
      id              TEXT PRIMARY KEY,
      eventName       TEXT NOT NULL DEFAULT 'Henna Night',
      eventDate       TEXT NOT NULL DEFAULT 'Saturday, May 2nd 2026',
      eventTime       TEXT NOT NULL DEFAULT '7:00 PM',
      eventLocation   TEXT NOT NULL DEFAULT '',
      hostName        TEXT NOT NULL DEFAULT 'Lihi',
      messageTemplate TEXT NOT NULL DEFAULT 'היי {name}! 🌿✨\n\nאת מוזמנת בחום לחינת החתן של {host_name}! 🎉\n\n📅 {date}\n⏰ {time}\n📍 {location}\n\nאשמח לדעת אם את מגיעה:\n{rsvp_link} 💛',
      primaryColor    TEXT NOT NULL DEFAULT '#7c1d2d',
      accentColor     TEXT NOT NULL DEFAULT '#d4af37',
      bgColor         TEXT NOT NULL DEFAULT '#fdf6e3'
    );
    INSERT OR IGNORE INTO Settings (id) VALUES ('default');
  `)
  // Incremental migrations — safe to run on existing databases
  try { db.exec('ALTER TABLE Guest ADD COLUMN partySize INTEGER') } catch { /* already exists */ }
  try { db.exec("ALTER TABLE Settings ADD COLUMN baseUrl TEXT NOT NULL DEFAULT 'http://localhost:3000'") } catch { /* already exists */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Guest {
  id: string; name: string; phone: string; token: string
  rsvpStatus: string | null; rsvpAt: string | null
  partySize: number | null
  messageSent: boolean; messageSentAt: string | null
  createdAt: string; updatedAt: string
}

export interface Settings {
  id: string; eventName: string; eventDate: string; eventTime: string
  eventLocation: string; hostName: string; messageTemplate: string
  primaryColor: string; accentColor: string; bgColor: string
  baseUrl: string
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export function findGuests(): Guest[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM Guest ORDER BY createdAt ASC').all() as Record<string, unknown>[]
  return rows.map(normalizeGuest)
}

export function findGuestByToken(token: string): Guest | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM Guest WHERE token = ?').get(token) as Record<string, unknown> | undefined
  return row ? normalizeGuest(row) : null
}

export function createGuest(name: string, phone: string, token: string): Guest {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO Guest (id, name, phone, token) VALUES (?, ?, ?, ?)').run(id, name, phone, token)
  return findGuestById(id)!
}

export function deleteGuest(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM Guest WHERE id = ?').run(id)
  return (result as { changes: number }).changes > 0
}

export function deleteAllGuests(): void {
  getDb().exec('DELETE FROM Guest')
}

export function updateGuestRsvpById(id: string, status: string | null, partySize?: number): Guest | null {
  const db = getDb()
  const now = new Date().toISOString()
  if (status === null) {
    db.prepare("UPDATE Guest SET rsvpStatus = NULL, rsvpAt = NULL, partySize = NULL, updatedAt = ? WHERE id = ?")
      .run(now, id)
  } else {
    db.prepare("UPDATE Guest SET rsvpStatus = ?, rsvpAt = ?, partySize = ?, updatedAt = ? WHERE id = ?")
      .run(status, now, partySize ?? null, now, id)
  }
  return findGuestById(id)
}

export function updateGuestRsvp(token: string, status: string, partySize?: number): Guest | null {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare("UPDATE Guest SET rsvpStatus = ?, rsvpAt = ?, partySize = ?, updatedAt = ? WHERE token = ?")
    .run(status, now, partySize ?? null, now, token)
  return findGuestByToken(token)
}

export function markMessageSent(id: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare("UPDATE Guest SET messageSent = 1, messageSentAt = ?, updatedAt = ? WHERE id = ?").run(now, now, id)
}

export function findUnsentGuests(): Guest[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM Guest WHERE messageSent = 0 ORDER BY createdAt ASC').all() as Record<string, unknown>[]
  return rows.map(normalizeGuest)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): Settings {
  const db = getDb()
  // Ensure row exists
  db.prepare("INSERT OR IGNORE INTO Settings (id) VALUES ('default')").run()
  const row = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as unknown as Settings
  return row
}

export function updateSettings(data: Partial<Omit<Settings, 'id'>>): Settings {
  const db = getDb()
  const allowed = ['eventName','eventDate','eventTime','eventLocation','hostName','messageTemplate','primaryColor','accentColor','bgColor','baseUrl'] as const
  const keys = (Object.keys(data) as string[]).filter(k => allowed.includes(k as typeof allowed[number]))
  if (keys.length) {
    const set = keys.map(k => `${k} = ?`).join(', ')
    const vals = keys.map(k => data[k as keyof typeof data])
    db.prepare(`UPDATE Settings SET ${set} WHERE id = 'default'`).run(...vals)
  }
  return getSettings()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findGuestById(id: string): Guest | null {
  const row = getDb().prepare('SELECT * FROM Guest WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? normalizeGuest(row) : null
}

function normalizeGuest(row: Record<string, unknown>): Guest {
  return {
    ...row,
    messageSent: row.messageSent === 1 || row.messageSent === true,
  } as Guest
}
