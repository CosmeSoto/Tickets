import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Formatea una fecha a formato legible en español
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Obtiene las iniciales de un nombre completo (máximo 2 caracteres, mayúsculas)
 */
export function getInitials(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

/**
 * Trunca un texto a la longitud máxima indicada, añadiendo "..." si se trunca
 */
export function truncateText(text: string, maxLength: number): string {
  if (maxLength === 0) return '...'
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Formatea una fecha con hora
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Formatea un precio en dólares
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Parsea montos de formularios aceptando "24", "24.50", "24,50" y "1.234,56".
 * Devuelve undefined si vacío o inválido (incluye distinguir 0 válido).
 */
export function parseMoneyInput(value: string | number | null | undefined): number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined

  let raw = String(value).trim().replace(/\s/g, '').replace(/[^\d.,\-]/g, '')
  if (!raw || raw === '-' || raw === '.' || raw === ',') return undefined

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  if (hasComma && hasDot) {
    // El último separador es decimal; el otro es miles
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.')
    } else {
      raw = raw.replace(/,/g, '')
    }
  } else if (hasComma) {
    raw = raw.replace(',', '.')
  }

  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}
