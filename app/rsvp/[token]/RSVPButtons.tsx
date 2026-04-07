'use client'

import { useState } from 'react'

interface Props {
  token: string
  primaryColor: string
  accentColor: string
}

type State = 'idle' | 'party_size' | 'submitting' | 'success_attending' | 'success_not_attending' | 'error'

export default function RSVPButtons({ token, primaryColor, accentColor }: Props) {
  const [state, setState] = useState<State>('idle')
  const [partySize, setPartySize] = useState(1)

  async function submit(status: 'attending' | 'not_attending', size?: number) {
    setState('submitting')
    try {
      const res = await fetch(`/api/rsvp/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, partySize: size }),
      })
      if (!res.ok) throw new Error('Failed')
      setState(status === 'attending' ? 'success_attending' : 'success_not_attending')
    } catch {
      setState('error')
    }
  }

  if (state === 'submitting') {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (state === 'party_size') {
    return (
      <div className="text-center py-2">
        <p className="font-medium text-gray-700 mb-1">כמה אנשים מגיעים?</p>
        <p className="text-xs text-gray-400 mb-6">כולל אותך</p>

        <div className="flex items-center justify-center gap-6 mb-8">
          <button
            onClick={() => setPartySize(s => Math.max(1, s - 1))}
            className="w-11 h-11 rounded-full text-xl font-bold flex items-center justify-center border-2 transition-all active:scale-95"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >−</button>

          <span className="text-5xl font-bold w-12 text-center" style={{ color: primaryColor }}>
            {partySize}
          </span>

          <button
            onClick={() => setPartySize(s => Math.min(10, s + 1))}
            className="w-11 h-11 rounded-full text-xl font-bold flex items-center justify-center text-white transition-all active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >+</button>
        </div>

        <button
          onClick={() => submit('attending', partySize)}
          className="w-full py-4 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 active:scale-95 shadow-md mb-3"
          style={{ backgroundColor: primaryColor }}
        >
          אישור ✓
        </button>
        <button
          onClick={() => { setState('idle'); setPartySize(1) }}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          ← חזרה
        </button>
      </div>
    )
  }

  if (state === 'success_attending' || state === 'success_not_attending') {
    const attending = state === 'success_attending'
    return (
      <div className="text-center py-4 animate-fade-in">
        <div className="text-5xl mb-4">{attending ? '🎉' : '💌'}</div>
        <h2 className="text-xl font-semibold mb-2" dir="rtl" style={{ color: primaryColor }}>
          {attending ? `מגיעים! ${partySize > 1 ? `${partySize} אנשים` : ''}` : "נתראה בחתונה!"}
        </h2>
        <p className="text-gray-500 text-sm">
          {attending
            ? "תודה על האישור! מחכים לראותכם 💛"
            : "תודה שהודעת לנו"}
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-center py-4">
        <p className="text-red-500 text-sm mb-3">משהו השתבש. נסי שוב.</p>
        <button onClick={() => setState('idle')} className="text-sm underline text-gray-500">חזרה</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-gray-600 text-sm font-medium mb-5">
        האם תגיעו?
      </p>

      <button
        onClick={() => setState('party_size')}
        className="w-full py-4 rounded-xl text-white font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-95 shadow-md"
        style={{ backgroundColor: primaryColor }}
      >
        <span className="mr-2">✓</span> כן, אני מגיע/ה!
      </button>

      <button
        onClick={() => submit('not_attending')}
        className="w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-95 border-2"
        style={{ borderColor: primaryColor + '50', color: primaryColor, backgroundColor: 'transparent' }}
      >
        <span className="mr-2">✗</span> לא אוכל להגיע
      </button>
    </div>
  )
}
