/**
 * Etiquetas del enum Prisma `LicenseAcquisitionType` (software_licenses.acquisitionType).
 * Única fuente de verdad — antes vivía duplicado inline en license-detail.tsx sin que
 * ningún formulario tuviera un campo para escribir el valor (por eso siempre salía "—").
 */
export const LICENSE_ACQUISITION_TYPE_LABELS: Record<string, string> = {
  SOFTWARE: 'Software / SaaS',
  SERVICE_EXTERNAL: 'Servicio externo',
  MAINTENANCE: 'Mantenimiento',
  INSURANCE: 'Seguro',
  SLA: 'SLA',
}

export const LICENSE_ACQUISITION_TYPE_OPTIONS = Object.entries(LICENSE_ACQUISITION_TYPE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
)

/**
 * Etiquetas del enum Prisma `LicenseRenewalFrequency` (software_licenses.renewalFrequency).
 * Solo aplica a licencias SIN contrato vinculado — cuando hay contrato, la periodicidad
 * real es el BillingCycle del Contract. CUSTOM habilita customFrequencyMonths.
 */
export const LICENSE_RENEWAL_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizada',
}

export const LICENSE_RENEWAL_FREQUENCY_OPTIONS = Object.entries(
  LICENSE_RENEWAL_FREQUENCY_LABELS
).map(([value, label]) => ({
  value,
  label,
}))

const LICENSE_RENEWAL_FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
}

/**
 * Suma la frecuencia de renovación a una fecha (YYYY-MM-DD) — usado para
 * autocompletar "Fecha de vencimiento" a partir de "Fecha de compra" +
 * "Frecuencia de renovación" en el formulario de licencia. Devuelve null si
 * falta algún dato (fecha inválida, frecuencia sin meses definidos).
 */
export function addRenewalInterval(
  dateStr: string,
  frequency: string,
  customMonths?: string | number | null
): string | null {
  if (!dateStr) return null
  const months =
    frequency === 'CUSTOM'
      ? typeof customMonths === 'string'
        ? parseInt(customMonths, 10)
        : customMonths
      : LICENSE_RENEWAL_FREQUENCY_MONTHS[frequency]
  if (!months || months <= 0) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  const originalDay = d.getDate()
  d.setMonth(d.getMonth() + months)
  // "31 de enero + 1 mes" desborda a marzo en JS (febrero no tiene día 31) —
  // si el día cambió por el desborde, aterriza en el último día del mes de
  // destino en vez de seguir corriendo hacia el mes siguiente.
  if (d.getDate() !== originalDay) d.setDate(0)
  return d.toISOString().slice(0, 10)
}

/**
 * Al vincular una licencia a un contrato, la categoría del contrato
 * (`ContractCategory`) pasa a ser la fuente de verdad de la "Modalidad de
 * adquisición" de la licencia (`LicenseAcquisitionType`) — antes eran dos
 * campos independientes que podían decir cosas distintas para el mismo
 * vínculo. Ver applyContractLinkSideEffects en license-contract.ts.
 * EQUIPMENT_RENTAL y OTHER no tienen un equivalente razonable en
 * LicenseAcquisitionType, así que no tocan el campo.
 */
export const CONTRACT_CATEGORY_TO_ACQUISITION_TYPE: Record<string, string | undefined> = {
  SOFTWARE_LICENSE: 'SOFTWARE',
  MAINTENANCE: 'MAINTENANCE',
  SUPPORT: 'SLA',
  SERVICE: 'SERVICE_EXTERNAL',
  EQUIPMENT_RENTAL: undefined,
  OTHER: undefined,
}
