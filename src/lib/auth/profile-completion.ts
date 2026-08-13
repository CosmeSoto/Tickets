/** Perfil incompleto para clientes: departamento y teléfono (Telegram). */
export function clientNeedsProfileCompletion(input: {
  role: string
  departmentId?: string | null
  phone?: string | null
}): boolean {
  if (input.role !== 'CLIENT') return false
  return !input.departmentId || !input.phone?.trim()
}

export function normalizePhoneInput(phone: string): string {
  return phone.trim()
}

export function validatePhoneInput(phone: string): string | null {
  const trimmed = normalizePhoneInput(phone)
  if (!trimmed) return 'El teléfono celular es requerido'
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return 'Formato de teléfono inválido. Usa solo números, espacios, +, - o paréntesis'
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7) return 'El teléfono debe tener al menos 7 dígitos'
  if (digits.length > 15) return 'El teléfono es demasiado largo'
  return null
}
