// WhatsApp and SMS links, same rules as the phone app's lib/phone.ts: digits only, and 91 is added
// to 10-digit Indian numbers. Messages open in WhatsApp / the messages app; nothing is sent automatically.
const digits = (phone: string) => phone.replace(/\D/g, '')
const withCountry = (phone: string) => {
  const d = digits(phone)
  return d.length === 10 ? `91${d}` : d
}

export const whatsAppUrl = (phone: string, message: string) =>
  `https://wa.me/${withCountry(phone)}?text=${encodeURIComponent(message)}`

export const smsUrl = (phone: string, message: string) => `sms:${digits(phone)}?body=${encodeURIComponent(message)}`
