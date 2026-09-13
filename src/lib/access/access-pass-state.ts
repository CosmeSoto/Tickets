/**
 * Máquina de estados y catálogos del módulo de Accesos — única fuente de verdad,
 * compartida por servidor (escáner, rutas) y cliente (access-console.tsx).
 *
 * `resolveAccessPassState` vivía en `access-control.ts` y el cliente reimplementaba
 * una versión propia (`effectivePassLabel`) con una PRECEDENCIA DISTINTA: evaluaba
 * vencimiento/inicio antes que SUSPENDED/PENDING_PRIVACY, y el estado del sujeto al
 * final. Resultado: un pase suspendido y vencido podía verse "EXPIRADO" en la tabla
 * mientras el escáner decía "SUSPENDED"; un sujeto inactivo con vigencia abierta
 * podía verse "VIGENTE". `resolveAccessPassDisplayState` usa exactamente la misma
 * precedencia que el escáner y solo agrega el refinamiento visual "por vencer"
 * sobre VALID — la divergencia deja de ser posible por construcción.
 *
 * `assertAccessStatusTransition` es la única fuente de verdad de qué cambios de
 * `status` acepta el módulo: cierra el bypass de consentimiento (no se puede
 * activar manualmente un pase sin que la persona haya aceptado el aviso de
 * privacidad al menos una vez) sin bloquear transiciones legítimas ya usadas por
 * la consola (p. ej. revocar un pase que sigue PENDING_PRIVACY).
 */

export const ACCESS_PASS_STATUSES = ['PENDING_PRIVACY', 'ACTIVE', 'SUSPENDED', 'REVOKED'] as const
export type AccessPassStatus = (typeof ACCESS_PASS_STATUSES)[number]

export const ACCESS_SCAN_RESULTS = [
  'VALID',
  'EXPIRED',
  'NOT_YET_VALID',
  'REVOKED',
  'SUSPENDED',
  'PENDING_PRIVACY',
  'INACTIVE_SUBJECT',
  'NOT_FOUND',
  'OUT_OF_SCOPE',
] as const
export type AccessScanResult = (typeof ACCESS_SCAN_RESULTS)[number]

export const ACCESS_SUBJECT_TYPES = ['TENANT_EMPLOYEE', 'AUTHORIZED_VISITOR', 'CONTRACTOR'] as const
export type AccessSubjectType = (typeof ACCESS_SUBJECT_TYPES)[number]

export type AccessPassStateInput = {
  status: AccessPassStatus
  validFrom: Date
  validUntil: Date
  subject: { isActive: boolean }
}

/** El subconjunto de resultados de escaneo que puede devolver un pase que sí existe. */
export type AccessPassResolvedState = Exclude<AccessScanResult, 'NOT_FOUND' | 'OUT_OF_SCOPE'>

/** Precedencia del escáner: sujeto inactivo > REVOKED > PENDING_PRIVACY > SUSPENDED > ventana de vigencia. */
export function resolveAccessPassState(pass: AccessPassStateInput): AccessPassResolvedState {
  const now = new Date()
  if (!pass.subject.isActive) return 'INACTIVE_SUBJECT'
  if (pass.status === 'REVOKED') return 'REVOKED'
  if (pass.status === 'PENDING_PRIVACY') return 'PENDING_PRIVACY'
  if (pass.status === 'SUSPENDED') return 'SUSPENDED'
  // "Todavía no inicia" y "ya venció" son estados distintos para quien escanea:
  // uno se resuelve esperando a la hora de inicio, el otro requiere reemitir el pase.
  if (pass.validFrom > now) return 'NOT_YET_VALID'
  // Inválido desde el instante de vencimiento (validUntil inclusive como límite).
  if (pass.validUntil <= now) return 'EXPIRED'
  return 'VALID'
}

export type AccessPassBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/** Estado de exhibición: igual a `resolveAccessPassState`, salvo el refinamiento "por vencer" sobre VALID. */
export type AccessPassDisplayState = AccessPassResolvedState | 'EXPIRING_SOON'

export function resolveAccessPassDisplayState(pass: AccessPassStateInput): AccessPassDisplayState {
  const base = resolveAccessPassState(pass)
  if (base !== 'VALID') return base
  const hoursLeft = (new Date(pass.validUntil).getTime() - Date.now()) / (1000 * 60 * 60)
  return hoursLeft <= 24 ? 'EXPIRING_SOON' : 'VALID'
}

/** Etiquetas para la tabla/tarjetas de pases (distintas de las del historial de escaneos). */
export const ACCESS_STATE_BADGES: Record<
  AccessPassDisplayState,
  { label: string; variant: AccessPassBadgeVariant }
> = {
  REVOKED: { label: 'REVOCADO', variant: 'destructive' },
  PENDING_PRIVACY: { label: 'PENDIENTE DE PRIVACIDAD', variant: 'outline' },
  SUSPENDED: { label: 'SUSPENDIDO', variant: 'outline' },
  NOT_YET_VALID: { label: 'PROGRAMADO', variant: 'outline' },
  EXPIRED: { label: 'EXPIRADO', variant: 'secondary' },
  INACTIVE_SUBJECT: { label: 'INACTIVO', variant: 'secondary' },
  EXPIRING_SOON: { label: 'POR VENCER', variant: 'outline' },
  VALID: { label: 'VIGENTE', variant: 'default' },
}

/** Etiquetas para el historial de escaneos (incluye NOT_FOUND/OUT_OF_SCOPE, que un pase nunca tiene como estado propio). */
export const ACCESS_SCAN_RESULT_BADGES: Record<
  AccessScanResult,
  { label: string; variant: AccessPassBadgeVariant }
> = {
  VALID: { label: 'Autorizado', variant: 'default' },
  EXPIRED: { label: 'Vencido', variant: 'secondary' },
  NOT_YET_VALID: { label: 'Aún no vigente', variant: 'outline' },
  REVOKED: { label: 'Revocado', variant: 'destructive' },
  SUSPENDED: { label: 'Suspendido', variant: 'outline' },
  PENDING_PRIVACY: { label: 'Pend. privacidad', variant: 'outline' },
  INACTIVE_SUBJECT: { label: 'Inactivo', variant: 'secondary' },
  NOT_FOUND: { label: 'No encontrado', variant: 'destructive' },
  OUT_OF_SCOPE: { label: 'Fuera de alcance', variant: 'secondary' },
}

/** Mensajes del escáner (distintos de las etiquetas cortas de los badges de arriba). */
export const ACCESS_SCAN_MESSAGES: Record<string, string> = {
  VALID: 'Acceso autorizado',
  EXPIRED: 'Credencial vencida',
  NOT_YET_VALID: 'Credencial aún no vigente: su periodo de acceso todavía no inicia',
  REVOKED: 'Credencial revocada',
  SUSPENDED: 'Credencial suspendida',
  PENDING_PRIVACY: 'Credencial pendiente: la persona aún no ha aceptado el aviso de privacidad.',
  INACTIVE_SUBJECT: 'La persona de esta credencial está inactiva',
  NOT_FOUND: 'Credencial no reconocida. Usa el QR o el código ACC-… de la tabla.',
  OUT_OF_SCOPE: 'No tienes autorización para verificar esta área.',
  FORBIDDEN: 'No tienes acceso al módulo de Accesos.',
}

export type AccessStatusTransitionCode = 'CONSENT_REQUIRED' | 'REVOKED_NEEDS_REISSUE'
export type AccessStatusTransitionResult =
  | { ok: true }
  | { ok: false; code: AccessStatusTransitionCode; message: string }

/**
 * Valida un cambio de `status` propuesto vía PATCH (gestión manual), no vía el
 * flujo público de aceptación (que usa su propio claim atómico en accept/route.ts).
 *
 * Reglas:
 * - Un pase REVOKED no puede salir de ahí sin `reissueQr` explícito (nunca se
 *   reactiva un QR que ya se sabe comprometido/retirado).
 * - Nunca se activa (ACTIVE) un pase que no tenga `privacyAcceptedAt` registrado
 *   — ni de PENDING_PRIVACY (el bug original: activar sin que la persona acepte)
 *   ni al reactivar un REVOKED que nunca llegó a tener consentimiento.
 * - Todo lo demás (incluida la revocación de un pase PENDING_PRIVACY, ya usada
 *   por la consola) queda permitido.
 */
export function assertAccessStatusTransition(
  current: AccessPassStatus,
  next: AccessPassStatus,
  opts: { reissueQr?: boolean; hasPrivacyAcceptance?: boolean } = {}
): AccessStatusTransitionResult {
  const reissueQr = Boolean(opts.reissueQr)
  const hasPrivacyAcceptance = Boolean(opts.hasPrivacyAcceptance)

  if (current === 'REVOKED' && next !== 'REVOKED' && !reissueQr) {
    return {
      ok: false,
      code: 'REVOKED_NEEDS_REISSUE',
      message:
        'Un pase revocado no se puede reactivar con el mismo QR. Usa reemisión para generar un código nuevo.',
    }
  }

  if (next === 'ACTIVE' && current !== 'ACTIVE' && !hasPrivacyAcceptance) {
    return {
      ok: false,
      code: 'CONSENT_REQUIRED',
      message:
        'No se puede activar una credencial sin que la persona haya aceptado el aviso de privacidad.',
    }
  }

  return { ok: true }
}
