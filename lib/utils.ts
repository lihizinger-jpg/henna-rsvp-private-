import { randomBytes } from 'crypto'

export function generateToken(): string {
  return randomBytes(16).toString('hex')
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function buildMessage(
  template: string,
  vars: { name: string; host_name: string; date: string; time: string; location: string; rsvp_link: string }
): string {
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{host_name\}/g, vars.host_name)
    .replace(/\{date\}/g, vars.date)
    .replace(/\{time\}/g, vars.time)
    .replace(/\{location\}/g, vars.location)
    .replace(/\{rsvp_link\}/g, vars.rsvp_link)
}

/** Format a phone number to WhatsApp's expected format: <digits>@c.us */
export function formatPhoneForWhatsApp(raw: string): string {
  let digits = String(raw).replace(/\D/g, '')

  // Israeli local format: 05x (10 digits) → 9725x
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '972' + digits.slice(1)
  } else if (digits.startsWith('0') && digits.length >= 9) {
    digits = '972' + digits.slice(1)
  }
  // If no country code and too short, assume Israel
  if (!digits.startsWith('972') && digits.length < 11) {
    digits = '972' + digits
  }

  return `${digits}@c.us`
}
