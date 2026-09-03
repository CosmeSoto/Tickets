/**
 * Etiquetas legibles para objeto afectado / código de evento en auditoría.
 * Sin UUIDs crudos en UI ni exportaciones.
 */

import { translateEntityType } from '@/lib/services/audit-export-helpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidLike(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

export type AuditAffectedSource = {
  action?: string | null
  entityType?: string | null
  entityId?: string | null
  details?: Record<string, any> | null
}

/** Texto legible del objeto sobre el que se actuó. */
export function getAffectedObjectLabel(row: AuditAffectedSource): string {
  const d = row.details || {}
  const entityType = (row.entityType || '').toLowerCase()
  const action = String(row.action || '')

  if (d.ticketNumber || d.ticketCode) return `Ticket #${d.ticketNumber || d.ticketCode}`
  if (d.ticketTitle) return `Ticket: ${d.ticketTitle}`
  if (d.targetUserName) return `Usuario: ${d.targetUserName}`
  if (d.userName && entityType === 'user') return `Usuario: ${d.userName}`
  if (d.categoryName) return `Categoría: ${d.categoryName}`
  if (d.departmentName) return `Departamento: ${d.departmentName}`
  if (d.familyName) return `Área: ${d.familyName}`
  if (entityType === 'equipment_invoice' || entityType === 'license_invoice') {
    // El id del activo (equipo/licencia) viaja dentro de `changes`, no como
    // entityId — ese es el de la propia factura. `d.assetName` ya viene
    // resuelto (código de equipo o nombre de licencia) desde enrichLogsBatch.
    const c = d.changes && typeof d.changes === 'object' ? d.changes : {}
    const amountValue = c.amount ?? c.after?.amount ?? c.before?.amount
    const currency = typeof c.currency === 'string' ? c.currency : 'USD'
    const parts: string[] = [c.invoiceNumber ? `Factura ${c.invoiceNumber}` : 'Factura']
    if (typeof amountValue === 'number') {
      parts.push(
        new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
        }).format(amountValue)
      )
    }
    if (d.assetName) {
      parts.push(
        entityType === 'equipment_invoice' ? `Equipo ${d.assetName}` : `Licencia ${d.assetName}`
      )
    }
    return parts.join(' · ')
  }
  if (entityType === 'contract_payment') {
    // El id del contrato viaja dentro de `changes` — `d.assetName` ya viene
    // resuelto (N° de contrato — nombre) desde enrichLogsBatch.
    const c = d.changes && typeof d.changes === 'object' ? d.changes : {}
    const amountValue = c.amount ?? c.after?.amount ?? c.before?.amount
    const currency = typeof c.currency === 'string' ? c.currency : 'USD'
    const parts: string[] = ['Cuota de contrato']
    if (typeof amountValue === 'number') {
      parts.push(
        new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
        }).format(amountValue)
      )
    }
    if (d.assetName) parts.push(String(d.assetName))
    return parts.join(' · ')
  }
  if (d.equipmentName || d.assetName) return `Activo: ${d.equipmentName || d.assetName}`
  if (d.credentialName) return `Credencial: ${d.credentialName}`
  if (d.credentialCode) return `Pase de acceso ${d.credentialCode}`
  if (d.entityName && !isUuidLike(d.entityName)) return String(d.entityName)

  if (typeof d.descripcion === 'string' && d.descripcion.trim()) {
    if (
      entityType === 'system' ||
      action.includes('EXPORT') ||
      action === 'AUDIT_LOGS_EXPORTED' ||
      row.entityId === 'audit-export' ||
      isUuidLike(row.entityId)
    ) {
      const text = d.descripcion.trim()
      return text.length > 100 ? `${text.slice(0, 97)}…` : text
    }
  }

  if (row.entityId === 'audit-export') return 'Exportación de auditoría'
  if (!row.entityId || row.entityId === '') {
    return translateEntityType(row.entityType || '') || '—'
  }

  // UUID u otro id técnico: no mostrarlo completo
  if (isUuidLike(row.entityId)) {
    const typeLabel = translateEntityType(row.entityType || '')
    return typeLabel ? `${typeLabel} (registro interno)` : 'Registro interno del sistema'
  }

  // Códigos legibles (ej. CONT-2026-001, audit-export)
  if (!isUuidLike(row.entityId) && String(row.entityId).length <= 64) {
    const typeLabel = translateEntityType(row.entityType || '')
    return typeLabel ? `${typeLabel}: ${row.entityId}` : String(row.entityId)
  }

  const typeLabel = translateEntityType(row.entityType || '')
  return `${typeLabel || 'Objeto'} · ref. ${String(row.entityId).slice(0, 8)}`
}

/** Etiqueta de campo según tipo de entidad */
export function getAffectedObjectFieldLabel(entityType?: string | null): string {
  switch ((entityType || '').toLowerCase()) {
    case 'user':
      return 'Usuario afectado'
    case 'ticket':
      return 'Ticket'
    case 'category':
      return 'Categoría'
    case 'department':
      return 'Departamento'
    case 'access_pass':
    case 'access_scan':
    case 'access_subject':
      return 'Pase de acceso'
    case 'system':
      return 'Qué se registró'
    case 'equipment_invoice':
    case 'license_invoice':
      return 'Factura'
    case 'contract':
      return 'Contrato'
    case 'contract_payment':
      return 'Cuota'
    default:
      return 'Objeto afectado'
  }
}

/** Código corto del evento (soporte), no el UUID completo. */
export function getEventCode(id?: string | null): string {
  if (!id) return ''
  return `EVT-${String(id).slice(0, 8).toUpperCase()}`
}
