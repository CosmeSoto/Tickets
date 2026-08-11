/**
 * Contacto WhatsApp para catálogo de equipos en desuso (FOR_SALE).
 * Prioridad: familia → CMS landing → system_settings.
 */

/** Extrae dígitos E.164-ish desde teléfono o URL wa.me / api.whatsapp.com */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // wa.me/593... o api.whatsapp.com/send?phone=593...
  const fromUrl =
    trimmed.match(/wa\.me\/(\+?\d+)/i)?.[1] ||
    trimmed.match(/[?&]phone=(\+?\d+)/i)?.[1] ||
    null

  const source = fromUrl || trimmed
  const digits = source.replace(/\D/g, '')
  // Mínimo razonable (local+país); máximo E.164
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

export type SalesWhatsAppSources = {
  familyWhatsapp?: string | null
  landingSocialWhatsapp?: string | null
  landingContactPhone?: string | null
  settingsSocialWhatsapp?: string | null
  settingsContactPhone?: string | null
}

/**
 * Resuelve el número de contacto para un ítem en venta.
 * Familia gana (contacto del área); luego CMS/global.
 */
export function resolveSalesWhatsAppPhone(sources: SalesWhatsAppSources): string | null {
  return (
    normalizeWhatsAppPhone(sources.familyWhatsapp) ||
    normalizeWhatsAppPhone(sources.landingSocialWhatsapp) ||
    normalizeWhatsAppPhone(sources.landingContactPhone) ||
    normalizeWhatsAppPhone(sources.settingsSocialWhatsapp) ||
    normalizeWhatsAppPhone(sources.settingsContactPhone) ||
    null
  )
}

/** URL wa.me lista para abrir (sin mensaje). */
export function buildWhatsAppChatUrl(phone: string, text?: string): string {
  const clean = normalizeWhatsAppPhone(phone) || phone.replace(/\D/g, '')
  const base = `https://wa.me/${clean}`
  if (!text) return base
  return `${base}?text=${encodeURIComponent(text)}`
}
