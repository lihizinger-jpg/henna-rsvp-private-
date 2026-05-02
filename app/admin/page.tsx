'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Users, MessageCircle, CheckCircle2, XCircle, Clock,
  Upload, Trash2, Send, Settings, Smartphone, RefreshCw,
  Plus, Download, ExternalLink, LogOut, Loader2, AlertCircle, Pencil,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Guest {
  id: string
  name: string
  phone: string
  token: string
  rsvpStatus: string | null
  rsvpAt: string | null
  partySize: number | null
  messageSent: boolean
  messageSentAt: string | null
  createdAt: string
}

interface Stats { total: number; attending: number; notAttending: number; pending: number; totalAttendees: number }

interface AppSettings {
  eventName: string; eventDate: string; eventTime: string
  eventLocation: string; hostName: string; messageTemplate: string
  primaryColor: string; accentColor: string; bgColor: string
  baseUrl: string
}

interface WAStatus { status: 'disconnected' | 'loading' | 'qr_pending' | 'connected'; phone?: string; qrImage?: string; error?: string }

type Tab = 'overview' | 'guests' | 'messages' | 'design'

const DEFAULT_SETTINGS: AppSettings = {
  eventName: 'Henna Night', eventDate: 'Saturday, May 2nd 2026',
  eventTime: '7:00 PM', eventLocation: '', hostName: 'Lihi',
  messageTemplate: "היי {name}! 🌿✨\n\nאת מוזמנת בחום לחינת החתן של {host_name}! 🎉\n\n📅 {date}\n⏰ {time}\n📍 {location}\n\nאשמח לדעת אם את מגיעה:\n{rsvp_link} 💛",
  primaryColor: '#7c1d2d', accentColor: '#d4af37', bgColor: '#fdf6e3',
  baseUrl: 'http://localhost:3000',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badge(status: string | null) {
  if (!status) return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">Pending</span>
  if (status === 'attending') return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Attending ✓</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-600 font-medium">Not attending</span>
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [guests, setGuests] = useState<Guest[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, attending: 0, notAttending: 0, pending: 0, totalAttendees: 0 })
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [wa, setWa] = useState<WAStatus>({ status: 'disconnected' })
  const [loading, setLoading] = useState(true)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [sendingParking, setSendingParking] = useState(false)
  const [parkingResult, setParkingResult] = useState<{ sent: number; failed: number } | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchGuests = useCallback(async () => {
    const res = await fetch('/api/guests')
    const data = await res.json()
    setGuests(data.guests ?? [])
    setStats(data.stats ?? { total: 0, attending: 0, notAttending: 0, pending: 0 })
  }, [])

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data)
  }, [])

  const fetchWaStatus = useCallback(async () => {
    const res = await fetch('/api/whatsapp/status')
    const data = await res.json()
    setWa(data)
  }, [])

  useEffect(() => {
    Promise.all([fetchGuests(), fetchSettings(), fetchWaStatus()]).finally(() => setLoading(false))
    const interval = setInterval(fetchWaStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchGuests, fetchSettings, fetchWaStatus])

  // Re-fetch guests when RSVP tab is open (to get latest statuses)
  useEffect(() => {
    if (tab === 'guests' || tab === 'overview') fetchGuests()
  }, [tab, fetchGuests])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function uploadExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/guests', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Upload failed'); return }
    alert(`Added ${data.added} guests${data.skipped ? ` (${data.skipped} skipped)` : ''}`)
    await fetchGuests()
    e.target.value = ''
  }

  async function addSingleGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fd.get('name'), phone: fd.get('phone') }),
    })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    ;(e.currentTarget as HTMLFormElement).reset()
    await fetchGuests()
  }

  async function updateGuestRsvp(id: string, status: string | null, partySize?: number) {
    await fetch(`/api/guests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvpStatus: status, partySize }),
    })
    await fetchGuests()
  }

  async function deleteGuest(id: string) {    if (!confirm('Remove this guest?')) return
    await fetch(`/api/guests/${id}`, { method: 'DELETE' })
    await fetchGuests()
  }

  async function deleteAllGuests() {
    if (!confirm('Delete ALL guests? This cannot be undone.')) return
    await fetch('/api/guests', { method: 'DELETE' })
    await fetchGuests()
  }

  async function connectWhatsApp() {
    setWa(w => ({ ...w, status: 'loading' }))  // immediate feedback
    await fetch('/api/whatsapp/connect', { method: 'POST' })
  }

  async function disconnectWhatsApp() {
    await fetch('/api/whatsapp/disconnect', { method: 'POST' })
    setWa({ status: 'disconnected' })
  }

  async function sendMessages() {
    setSending(true)
    setSendResult(null)
    const res = await fetch('/api/send-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlyPending: true }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Failed to send'); setSending(false); return }
    setSendResult({ sent: data.sent, failed: data.failed })
    setSending(false)
    await fetchGuests()
  }

  async function sendParkingMessages() {
    setSendingParking(true)
    setParkingResult(null)
    const res = await fetch('/api/send-parking', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Failed to send'); setSendingParking(false); return }
    setParkingResult({ sent: data.sent, failed: data.failed })
    setSendingParking(false)
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL ?? ''

  // ── UI ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#7c1d2d]" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-stone-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌿</span>
            <div>
              <h1 className="font-semibold text-stone-800 leading-none">{settings.eventName}</h1>
              <p className="text-xs text-stone-400">{settings.eventDate} · {settings.eventTime}</p>
            </div>
          </div>
          <WaBadge wa={wa} />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ── Tab bar ── */}
        <div className="flex gap-1 bg-white rounded-xl p-1 mb-6 shadow-sm border border-stone-200 w-fit">
          {([
            ['overview', 'Overview', CheckCircle2],
            ['guests',   'Guests',   Users],
            ['messages', 'Messages', MessageCircle],
            ['design',   'Design',   Settings],
          ] as [Tab, string, React.ElementType][]).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id ? 'bg-[#7c1d2d] text-white shadow' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === 'overview' && (
          <OverviewTab stats={stats} guests={guests} baseUrl={baseUrl} />
        )}
        {tab === 'guests' && (
          <GuestsTab
            guests={guests} fileRef={fileRef} baseUrl={baseUrl}
            onUpload={uploadExcel} onAdd={addSingleGuest} onDelete={deleteGuest} onDeleteAll={deleteAllGuests}
            onRsvpUpdate={updateGuestRsvp}
          />
        )}
        {tab === 'messages' && (
          <MessagesTab
            wa={wa} settings={settings} guests={guests}
            sending={sending} sendResult={sendResult}
            sendingParking={sendingParking} parkingResult={parkingResult}
            onConnect={connectWhatsApp} onDisconnect={disconnectWhatsApp}
            onSend={sendMessages} onSendParking={sendParkingMessages}
          />
        )}
        {tab === 'design' && (
          <DesignTab settings={settings} saved={settingsSaved} onChange={setSettings} onSave={saveSettings} baseUrl={baseUrl} />
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WaBadge({ wa }: { wa: WAStatus }) {
  const map = {
    disconnected: ['bg-stone-100 text-stone-500', 'Disconnected'],
    loading:      ['bg-amber-100 text-amber-600', 'Connecting…'],
    qr_pending:   ['bg-blue-100 text-blue-600',   'Scan QR'],
    connected:    ['bg-green-100 text-green-700',  wa.phone ? `+${wa.phone}` : 'Connected'],
  }
  const [cls, label] = map[wa.status] ?? map.disconnected
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
      <Smartphone size={12} /> {label}
    </span>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ stats, guests, baseUrl }: { stats: Stats; guests: Guest[]; baseUrl: string }) {
  const recent = [...guests].filter(g => g.rsvpStatus).sort((a,b) => new Date(b.rsvpAt!).getTime() - new Date(a.rsvpAt!).getTime()).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<Users size={20} />}        label="Total invited"    value={stats.total}          color="bg-stone-100 text-stone-600" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Attending"        value={stats.attending}      color="bg-green-100 text-green-600" />
        <StatCard icon={<XCircle size={20} />}      label="Not attending"    value={stats.notAttending}   color="bg-red-100 text-red-500" />
        <StatCard icon={<Clock size={20} />}        label="Awaiting reply"   value={stats.pending}        color="bg-amber-100 text-amber-600" />
        <StatCard icon={<Users size={20} />}        label="Total attendees"  value={stats.totalAttendees} color="bg-purple-100 text-purple-600" />
      </div>

      {stats.total > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
          <h3 className="text-sm font-semibold text-stone-600 mb-3">Response rate</h3>
          <div className="h-3 rounded-full bg-stone-100 overflow-hidden flex">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${(stats.attending / stats.total) * 100}%` }} />
            <div className="bg-red-400 h-full transition-all"   style={{ width: `${(stats.notAttending / stats.total) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-stone-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Attending {stats.attending}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Not attending {stats.notAttending}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-200 inline-block"/>Pending {stats.pending}</span>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
          <h3 className="text-sm font-semibold text-stone-600 mb-3">Recent responses</h3>
          <div className="space-y-2">
            {recent.map(g => (
              <div key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-700 font-medium">{g.name}</span>
                <div className="flex items-center gap-3">
                  {badge(g.rsvpStatus)}
                  {g.rsvpAt && <span className="text-xs text-stone-400">{new Date(g.rsvpAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="text-center py-16 text-stone-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No guests yet</p>
          <p className="text-sm mt-1">Go to the <strong>Guests</strong> tab to upload your list.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-200">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500 mt-0.5">{label}</p>
    </div>
  )
}

// ── Guests ────────────────────────────────────────────────────────────────────

function GuestsTab({ guests, fileRef, baseUrl, onUpload, onAdd, onDelete, onDeleteAll, onRsvpUpdate }: {
  guests: Guest[]; fileRef: React.RefObject<HTMLInputElement>; baseUrl: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAdd: (e: React.FormEvent<HTMLFormElement>) => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
  onRsvpUpdate: (id: string, status: string | null, partySize?: number) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<string | null>(null)
  const [editPartySize, setEditPartySize] = useState(1)

  function startEdit(g: Guest) {
    setEditId(g.id)
    setEditStatus(g.rsvpStatus)
    setEditPartySize(g.partySize ?? 1)
  }

  function cancelEdit() { setEditId(null) }

  async function saveEdit(id: string) {
    await onRsvpUpdate(id, editStatus, editStatus === 'attending' ? editPartySize : undefined)
    setEditId(null)
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    await onAdd(e)
    setShowAdd(false)
  }

  return (
    <div className="space-y-5">
      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onUpload} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c1d2d] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Upload size={15} /> Upload Excel
        </button>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50">
          <Plus size={15} /> Add guest
        </button>
        {guests.length > 0 && (
          <button onClick={onDeleteAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 ml-auto">
            <Trash2 size={15} /> Clear all
          </button>
        )}
      </div>

      {/* Excel format hint */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        Excel file should have columns named <strong className="mx-1">Name</strong> and <strong className="mx-1">Phone</strong> (Hebrew columns also supported: שם / טלפון).
      </div>

      {/* Add single guest form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="flex gap-2 items-end p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="flex-1">
            <label className="text-xs text-stone-500 block mb-1">Name</label>
            <input name="name" required placeholder="Guest name" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-stone-500 block mb-1">Phone</label>
            <input name="phone" required placeholder="0501234567" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]" />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#7c1d2d] text-white rounded-lg text-sm font-medium hover:opacity-90">Add</button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 text-stone-400 text-sm hover:text-stone-600">Cancel</button>
        </form>
      )}

      {/* Table */}
      {guests.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No guests yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  {['Name', 'Phone', 'RSVP', 'Party', 'Message', 'RSVP Link', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {guests.map(g => (
                  <tr key={g.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{g.name}</td>
                    <td className="px-4 py-3 text-stone-500 font-mono text-xs">{g.phone}</td>
                    <td className="px-4 py-3">
                      {editId === g.id ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => setEditStatus('attending')}
                            className={`px-2 py-1 rounded text-xs font-medium ${editStatus === 'attending' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                            מגיע/ה
                          </button>
                          {editStatus === 'attending' && (
                            <input
                              type="number" min={1} max={30} value={editPartySize}
                              onChange={e => setEditPartySize(Math.max(1, +e.target.value))}
                              className="w-12 border border-stone-300 rounded px-1 py-0.5 text-xs text-center" />
                          )}
                          <button
                            onClick={() => setEditStatus('not_attending')}
                            className={`px-2 py-1 rounded text-xs font-medium ${editStatus === 'not_attending' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                            לא מגיע/ה
                          </button>
                          <button
                            onClick={() => setEditStatus(null)}
                            className={`px-2 py-1 rounded text-xs font-medium ${editStatus === null ? 'bg-stone-400 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                            ממתין/ה
                          </button>
                          <button onClick={() => saveEdit(g.id)} className="px-2 py-1 rounded text-xs font-medium bg-[#7c1d2d] text-white hover:opacity-90">שמור</button>
                          <button onClick={cancelEdit} className="text-xs text-stone-400 hover:text-stone-600">ביטול</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {badge(g.rsvpStatus)}
                          <button onClick={() => startEdit(g)} className="text-stone-300 hover:text-stone-500 transition-colors" title="עדכן ידנית">
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {g.rsvpStatus === 'attending'
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">👥 {g.partySize ?? 1}</span>
                        : <span className="text-xs text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {g.messageSent
                        ? <span className="text-xs text-green-600">Sent ✓</span>
                        : <span className="text-xs text-stone-400">Not sent</span>}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`${baseUrl}/rsvp/${g.token}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#7c1d2d] hover:underline">
                        View <ExternalLink size={11} />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDelete(g.id)} className="text-stone-300 hover:text-red-400 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 text-xs text-stone-400">
            {guests.length} guest{guests.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Messages ──────────────────────────────────────────────────────────────────

function MessagesTab({ wa, settings, guests, sending, sendResult, sendingParking, parkingResult, onConnect, onDisconnect, onSend, onSendParking }: {
  wa: WAStatus; settings: AppSettings; guests: Guest[]
  sending: boolean; sendResult: { sent: number; failed: number } | null
  sendingParking: boolean; parkingResult: { sent: number; failed: number } | null
  onConnect: () => void; onDisconnect: () => void; onSend: () => void; onSendParking: () => void
}) {
  const pending = guests.filter(g => !g.messageSent).length
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const [testPhone, setTestPhone] = useState('')
  const [testName, setTestName] = useState('')
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function sendTest() {
    if (!testPhone.trim()) return
    setTestState('sending')
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 210000)
      const res = await fetch('/api/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, name: testName }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      setTestState(res.ok ? 'ok' : 'error')
    } catch {
      setTestState('error')
    }
    setTimeout(() => setTestState('idle'), 3000)
  }

  const preview = settings.messageTemplate
    .replace('{name}', 'Sarah')
    .replace('{host_name}', settings.hostName)
    .replace('{date}', settings.eventDate)
    .replace('{time}', settings.eventTime)
    .replace('{location}', settings.eventLocation || '[Location]')
    .replace('{rsvp_link}', `${baseUrl}/rsvp/abc123`)

  return (
    <div className="space-y-6">
      {/* WhatsApp connection */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
          <Smartphone size={16} /> WhatsApp Connection
        </h3>

        {wa.status === 'disconnected' && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-stone-500">לא מחובר.</p>
            <button onClick={onConnect}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90">
              <Smartphone size={14} /> חבר WhatsApp
            </button>
          </div>
        )}
        {wa.error && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">שגיאה בחיבור</p>
              <p className="text-xs mt-0.5 font-mono">{wa.error}</p>
            </div>
          </div>
        )}

        {wa.status === 'loading' && (
          <div className="flex items-center gap-3 text-amber-600">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">מפעיל את Chrome… זה עשוי לקחת עד 60 שניות.</span>
          </div>
        )}

        {wa.status === 'qr_pending' && (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {wa.qrImage
              ? <img src={wa.qrImage} alt="WhatsApp QR code" className="w-44 h-44 rounded-xl border-4 border-white shadow-md" />
              : <div className="w-44 h-44 rounded-xl bg-stone-100 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" /></div>
            }
            <div className="text-sm text-stone-600 space-y-2">
              <p className="font-semibold text-stone-800">Scan this QR code</p>
              <ol className="list-decimal list-inside space-y-1 text-stone-500">
                <li>Open WhatsApp on your phone</li>
                <li>Tap <strong>⋮ → Linked devices</strong></li>
                <li>Tap <strong>Link a device</strong></li>
                <li>Scan the QR code on the left</li>
              </ol>
            </div>
          </div>
        )}

        {wa.status === 'connected' && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>
              Connected {wa.phone && `(+${wa.phone})`}
            </span>
            <button onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-stone-400 hover:text-red-500 text-sm">
              <LogOut size={14} /> Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Send messages */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-700 mb-1 flex items-center gap-2">
          <Send size={16} /> Send Invitations
        </h3>
        <p className="text-xs text-stone-400 mb-4">
          {pending} guest{pending !== 1 ? 's' : ''} haven't received a message yet.
        </p>

        {sendResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${sendResult.failed ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            <CheckCircle2 size={15} />
            {sendResult.sent} sent successfully{sendResult.failed ? `, ${sendResult.failed} failed` : ''}.
          </div>
        )}

        <button
          onClick={onSend}
          disabled={sending || wa.status !== 'connected' || pending === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#7c1d2d] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send to {pending} guests</>}
        </button>

        {wa.status !== 'connected' && (
          <p className="mt-2 text-xs text-stone-400">Connect WhatsApp above before sending.</p>
        )}
      </div>

      {/* Parking notification */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-700 mb-1 flex items-center gap-2">
          🅿️ הודעת חניון
        </h3>
        <p className="text-xs text-stone-400 mb-3">
          שלח לכל מי שאישר הגעה ({guests.filter(g => g.rsvpStatus === 'attending').length} אורחים) הודעה עם פרטי החניון ברחוב שלמה 4 (חצרות יפו).
        </p>
        <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm text-sm text-stone-800 whitespace-pre-line shadow-sm font-sans mb-4 text-right" dir="rtl">
          {`היי [שם]! 🌿\n\nאנחנו מתרגשים לפגוש אתכם הערב! 🎉\nהאירוע מתחיל בשעה 19:00 ⏰\n\nלידיעתכם, יש חניון לרשותכם ברחוב שלמה 4 (חצרות יפו).\nבכניסה תוכלו לקבל מדבקה של הנחה של 40 ש״ח 🅿️\n\n5 דקות הליכה מהמקום 🚶\n\nנפגש! 🩷`}
        </div>

        {parkingResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${parkingResult.failed ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            <CheckCircle2 size={15} />
            {parkingResult.sent} נשלחו בהצלחה{parkingResult.failed ? `, ${parkingResult.failed} נכשלו` : ''}.
          </div>
        )}

        <button
          onClick={onSendParking}
          disabled={sendingParking || wa.status !== 'connected' || guests.filter(g => g.rsvpStatus === 'attending').length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#7c1d2d] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sendingParking
            ? <><Loader2 size={15} className="animate-spin" /> שולח…</>
            : <><Send size={15} /> שלח ל-{guests.filter(g => g.rsvpStatus === 'attending').length} מאשרים</>}
        </button>
        {wa.status !== 'connected' && (
          <p className="mt-2 text-xs text-stone-400">חבר WhatsApp למעלה לפני השליחה.</p>
        )}
      </div>

      {/* Test message */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-700 mb-1 flex items-center gap-2">
          <Smartphone size={16} /> שלח הודעת נסיון
        </h3>
        <p className="text-xs text-stone-400 mb-4">ישלח את תבנית ההודעה עם השם שתזיני לנייד שלך. הקישור יפתח דף תצוגה מקדימה.</p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="שם לדוגמה (רשות)"
            value={testName}
            onChange={e => setTestName(e.target.value)}
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="0501234567"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]"
          />
          <button
            onClick={sendTest}
            disabled={testState === 'sending' || wa.status !== 'connected' || !testPhone.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#7c1d2d] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {testState === 'sending' ? <><Loader2 size={14} className="animate-spin" /> שולח…</> :
             testState === 'ok'      ? <><CheckCircle2 size={14} /> נשלח!</> :
             testState === 'error'   ? <><AlertCircle size={14} /> שגיאה</> :
             <><Send size={14} /> שלח נסיון</>}
          </button>
        </div>
        {wa.status !== 'connected' && (
          <p className="mt-2 text-xs text-stone-400">חבר WhatsApp למעלה לפני השליחה.</p>
        )}
      </div>

      {/* Message preview */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
        <h3 className="font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <MessageCircle size={16} /> Message Preview
        </h3>
        <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm text-sm text-stone-800 whitespace-pre-line shadow-sm font-sans">
          {preview}
        </div>
        <p className="text-xs text-stone-400 mt-2">Edit the template in the <strong>Design</strong> tab.</p>
      </div>
    </div>
  )
}

// ── Design ────────────────────────────────────────────────────────────────────

function DesignTab({ settings, saved, onChange, onSave, baseUrl }: {
  settings: AppSettings; saved: boolean
  onChange: React.Dispatch<React.SetStateAction<AppSettings>>
  onSave: (e: React.FormEvent) => void
  baseUrl: string
}) {
  const [detecting, setDetecting] = useState(false)

  async function detectLocalIP() {
    setDetecting(true)
    try {
      const res = await fetch('/api/local-ip')
      const { ip } = await res.json()
      onChange(s => ({ ...s, baseUrl: `http://${ip}:3000` }))
    } finally {
      setDetecting(false)
    }
  }
  function field(key: keyof AppSettings, label: string, type: 'text' | 'color' | 'textarea' = 'text', placeholder?: string) {
    return (
      <div key={key}>
        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1">{label}</label>
        {type === 'textarea' ? (
          <textarea
            value={settings[key]}
            onChange={e => onChange(s => ({ ...s, [key]: e.target.value }))}
            rows={5}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d] font-mono resize-y"
          />
        ) : type === 'color' ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings[key]}
              onChange={e => onChange(s => ({ ...s, [key]: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-stone-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={settings[key]}
              onChange={e => onChange(s => ({ ...s, [key]: e.target.value }))}
              className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]"
              placeholder="#000000"
            />
          </div>
        ) : (
          <input
            type="text"
            value={settings[key]}
            onChange={e => onChange(s => ({ ...s, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]"
          />
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      {/* Base URL */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200 space-y-3">
        <h3 className="font-semibold text-stone-700">כתובת האתר (Base URL)</h3>
        <p className="text-xs text-stone-400">
          הכתובת שתופיע בקישורי RSVP. לטסטינג מהנייד — השתמשי בכתובת ה-IP המקומית. לפרודקשן — כתובת Railway.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.baseUrl}
            onChange={e => onChange(s => ({ ...s, baseUrl: e.target.value }))}
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#7c1d2d]/20 focus:border-[#7c1d2d]"
            placeholder="http://192.168.1.x:3000"
          />
          <button
            type="button"
            onClick={detectLocalIP}
            disabled={detecting}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 border border-stone-200 text-stone-600 rounded-lg text-sm hover:bg-stone-200 disabled:opacity-50 whitespace-nowrap"
          >
            {detecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            זהה אוטומטית
          </button>
        </div>
        <p className="text-xs text-stone-400">
          הנייד והמחשב חייבים להיות על אותה רשת WiFi.
        </p>
      </div>

      {/* Event details */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200 space-y-4">
        <h3 className="font-semibold text-stone-700">Event Details</h3>
        {field('hostName',      'Host name')}
        {field('eventName',     'Event name')}
        {field('eventDate',     'Date',     'text', 'Saturday, May 2nd 2026')}
        {field('eventTime',     'Time',     'text', '7:00 PM')}
        {field('eventLocation', 'Location', 'text', 'Address or venue name')}
      </div>

      {/* Message template */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200 space-y-4">
        <h3 className="font-semibold text-stone-700">WhatsApp Message Template</h3>
        {field('messageTemplate', 'Template', 'textarea')}
        <div className="text-xs text-stone-400 space-y-0.5">
          <p>Available variables:</p>
          <p><code className="bg-stone-100 px-1 rounded">{'{name}'}</code> Guest's name &nbsp;|&nbsp; <code className="bg-stone-100 px-1 rounded">{'{host_name}'}</code> &nbsp;|&nbsp; <code className="bg-stone-100 px-1 rounded">{'{date}'}</code> &nbsp;|&nbsp; <code className="bg-stone-100 px-1 rounded">{'{time}'}</code> &nbsp;|&nbsp; <code className="bg-stone-100 px-1 rounded">{'{location}'}</code> &nbsp;|&nbsp; <code className="bg-stone-100 px-1 rounded">{'{rsvp_link}'}</code></p>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200 space-y-4">
        <h3 className="font-semibold text-stone-700">RSVP Page Colors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field('primaryColor', 'Primary color',  'color')}
          {field('accentColor',  'Accent / gold',  'color')}
          {field('bgColor',      'Background',     'color')}
        </div>
        <a href="/rsvp/preview" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#7c1d2d] hover:underline">
          <ExternalLink size={13} /> Preview RSVP page (save first)
        </a>
      </div>

      <button type="submit"
        className="flex items-center gap-2 px-6 py-2.5 bg-[#7c1d2d] text-white rounded-lg font-medium text-sm hover:opacity-90">
        {saved ? <><CheckCircle2 size={15} /> Saved!</> : 'Save changes'}
      </button>
    </form>
  )
}
