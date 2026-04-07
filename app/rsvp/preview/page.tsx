export const dynamic = 'force-dynamic'

import { getSettings } from '@/lib/db'
import RSVPButtons from '../[token]/RSVPButtons'

export default async function RSVPPreviewPage({ searchParams }: { searchParams: { name?: string } }) {
  const settings = getSettings()
  const guestName = searchParams.name?.trim() || 'שרה כהן'
  const isTest = !!searchParams.name

  const mockGuest = { name: guestName, token: 'preview' }

  return (
    <>
      <style>{`
        body { background-color: ${settings.bgColor}; margin: 0; }
      `}</style>

      {!isTest && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 text-center text-xs font-semibold py-2 px-4">
          תצוגה מקדימה בלבד — כך האורחים יראו את הדף
        </div>
      )}

      <main className="min-h-screen flex items-center justify-center p-4 pt-12"
        style={{ backgroundColor: settings.bgColor }}>
        <div className="w-full max-w-md">

          <div className="flex items-center justify-center mb-6">
            <HennaOrnament color={settings.accentColor} />
          </div>

          <div className="rounded-2xl shadow-2xl overflow-hidden"
            style={{ border: `2px solid ${settings.accentColor}` }}>

            <div className="px-8 py-6 text-center" style={{ backgroundColor: settings.primaryColor }}>
              <h1 className="text-2xl font-bold text-white leading-tight">
                הנכם מוזמנים ל{settings.eventName}
              </h1>
              <p className="mt-1 text-sm text-white/70">של {settings.hostName}</p>
            </div>

            <div className="px-8 py-7 bg-white">
              <p className="text-lg text-center mb-6" dir="rtl" style={{ color: settings.primaryColor }}>
                <span className="font-semibold">{mockGuest.name}</span>,
              </p>

              <div className="space-y-3 mb-7">
                {settings.eventDate     && <DetailRow icon="📅" label="תאריך"  value={settings.eventDate}     accent={settings.accentColor} />}
                {settings.eventTime     && <DetailRow icon="⏰" label="שעה"    value={settings.eventTime}     accent={settings.accentColor} />}
                {settings.eventLocation && <DetailRow icon="📍" label="מיקום"  value={settings.eventLocation} accent={settings.accentColor} />}
              </div>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px" style={{ backgroundColor: settings.accentColor + '40' }} />
                <span style={{ color: settings.accentColor }}>✦</span>
                <div className="flex-1 h-px" style={{ backgroundColor: settings.accentColor + '40' }} />
              </div>

              <RSVPButtons
                token={mockGuest.token}
                primaryColor={settings.primaryColor}
                accentColor={settings.accentColor}
              />
            </div>
          </div>

          <div className="flex items-center justify-center mt-6">
            <HennaOrnament color={settings.accentColor} small />
          </div>
        </div>
      </main>
    </>
  )
}

function DetailRow({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-start gap-3 flex-row-reverse text-right">
      <span className="text-xl leading-none mt-0.5">{icon}</span>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
        <p className="text-gray-700 text-sm mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function HennaOrnament({ color, small }: { color: string; small?: boolean }) {
  const size = small ? 60 : 80
  return (
    <svg width={size} height={size / 2} viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 30 C45 10 20 10 10 30 C20 50 45 50 60 30Z" fill={color + '30'} stroke={color} strokeWidth="1"/>
      <path d="M60 30 C75 10 100 10 110 30 C100 50 75 50 60 30Z" fill={color + '30'} stroke={color} strokeWidth="1"/>
      <circle cx="60" cy="30" r="5" fill={color}/>
      <circle cx="30" cy="30" r="3" fill={color + '60'}/>
      <circle cx="90" cy="30" r="3" fill={color + '60'}/>
      <path d="M5 30 L20 30" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M100 30 L115 30" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
