/**
 * Etiquetas del enum Prisma `ContractType` (software_licenses.contractType).
 * Única fuente de verdad — antes vivía duplicado inline en license-detail.tsx sin que
 * ningún formulario tuviera un campo para escribir el valor (por eso siempre salía "—").
 */
export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SOFTWARE: 'Software / SaaS',
  SERVICE_EXTERNAL: 'Servicio externo',
  MAINTENANCE: 'Mantenimiento',
  INSURANCE: 'Seguro',
  SLA: 'SLA',
}

export const CONTRACT_TYPE_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))
