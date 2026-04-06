import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Henna Night RSVP',
  description: 'RSVP for Henna Night',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
