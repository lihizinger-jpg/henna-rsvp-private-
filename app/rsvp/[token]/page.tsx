export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { findGuestByToken, getSettings } from '@/lib/db'
import RSVPButtons from './RSVPButtons'

export default async function RSVPPage({ params }: { params: { token: string } }) {
  const guest = findGuestByToken(params.token)
  if (!guest) notFound()

  const settings = getSettings()

  return (
    <>
      <style>{`
        body { background-color: ${settings.bgColor}; margin: 0; }
      `}</style>

      <main className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: settings.bgColor }}>
        <div className="w-full max-w-md">

          <div className="flex items-center justify-center mb-6">
            <HennaOrnament color={settings.accentColor} />
          </div>

          <div className="rounded-2xl shadow-2xl overflow-hidden"
            style={{ border: `2px solid ${settings.accentColor}` }}>

            {/* Header */}
            <div className="px-8 py-6 text-center" style={{ backgroundColor: settings.primaryColor }}>
              <p className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: settings.accentColor }}>
                הנכם מוזמנים
              </p>
              <h1 className="font-serif text-3xl font-bold text-white leading-tight">
                {settings.eventName}
              </h1>
              <p className="mt-1 text-sm text-white/70">hosted by {settings.hostName}</p>
            </div>

            {/* Body */}
            <div className="px-8 py-7 bg-white">
              <p className="text-lg text-center mb-6" style={{ color: settings.primaryColor }}>
                <span className="font-semibold">{guest.name}</span>,
              </p>

              <div className="space-y-3 mb-7">
                {settings.eventDate     && <DetailRow icon="📅" label="Date"     value={settings.eventDate}     accent={settings.accentColor} />}
                {settings.eventTime     && <DetailRow icon="⏰" label="Time"     value={settings.eventTime}     accent={settings.accentColor} />}
                {settings.eventLocation && <DetailRow icon="📍" label="Location" value={settings.eventLocation} accent={settings.accentColor} />}
              </div>

              <Divider color={settings.accentColor} />

              {guest.rsvpStatus ? (
                <AlreadyResponded
                  status={guest.rsvpStatus}
                  primaryColor={settings.primaryColor}
                  accentColor={settings.accentColor}
                />
              ) : (
                <RSVPButtons
                  token={params.token}
                  primaryColor={settings.primaryColor}
                  accentColor={settings.accentColor}
                />
              )}
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

function Divider({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px" style={{ backgroundColor: color + '40' }} />
      <span style={{ color }}>✦</span>
      <div className="flex-1 h-px" style={{ backgroundColor: color + '40' }} />
    </div>
  )
}

function AlreadyResponded({ status, primaryColor, accentColor }: { status: string; primaryColor: string; accentColor: string }) {
  const attending = status === 'attending'
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full text-3xl mb-4"
        style={{ backgroundColor: attending ? '#dcfce7' : '#fee2e2' }}>
        {attending ? '🎉' : '💌'}
      </div>
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: primaryColor }}>
        {attending ? 'See you there!' : 'We\'ll miss you!'}
      </h2>
      <p className="text-gray-500 text-sm">
        {attending
          ? 'Your attendance is confirmed. Can\'t wait to celebrate together!'
          : 'Thank you for letting us know.'}
      </p>
      <div className="mt-4 inline-block px-4 py-1.5 rounded-full text-sm font-medium"
        style={{ backgroundColor: accentColor + '20', color: accentColor }}>
        Response recorded ✓
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
