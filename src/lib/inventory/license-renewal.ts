import prisma from '@/lib/prisma'

/**
 * Único lugar que sabe cómo aplicar un cambio de vencimiento/renovación a una
 * licencia: resetea las banderas de "ya avisé" (si no, el cron cree que ya
 * notificó para la fecha vieja y nunca vuelve a avisar) y deja un rastro en
 * license_renewal_history. Antes esta lógica vivía solo en PUT
 * /api/inventory/licenses/[id] — ahora también la usan la cascada de
 * renovación de un lote y la sincronización de licencias vinculadas a un
 * contrato, para no reescribirla tres veces.
 */
export type LicenseRenewalUpdateSource = 'direct' | 'batch-cascade' | 'contract-sync'

export interface LicenseRenewalUpdateInput {
  expirationDate?: Date | string | null
  renewalDate?: Date | string | null
  renewalCost?: number | null
  renewalFrequency?: string | null
  customFrequencyMonths?: number | null
}

export async function applyLicenseRenewalUpdate(
  licenseId: string,
  input: LicenseRenewalUpdateInput,
  changedById: string,
  source: LicenseRenewalUpdateSource = 'direct'
) {
  const existing = await prisma.software_licenses.findUnique({
    where: { id: licenseId },
    select: {
      expirationDate: true,
      renewalDate: true,
      renewalCost: true,
      renewalFrequency: true,
      batchId: true,
    },
  })
  if (!existing) throw new Error('Licencia no encontrada')

  const expirationTouched = input.expirationDate !== undefined
  const renewalTouched =
    input.renewalDate !== undefined ||
    input.renewalCost !== undefined ||
    input.renewalFrequency !== undefined

  const data: Record<string, unknown> = {}

  if (expirationTouched) {
    data.expirationDate = input.expirationDate
    // La fecha cambió: cualquier aviso ya enviado quedó obsoleto.
    data.expirationAlertFirstSentAt = null
    data.expirationAlertSecondSentAt = null
  }
  if (input.renewalDate !== undefined) data.renewalDate = input.renewalDate
  if (input.renewalCost !== undefined) data.renewalCost = input.renewalCost
  if (input.renewalFrequency !== undefined) data.renewalFrequency = input.renewalFrequency || null
  if (input.customFrequencyMonths !== undefined) {
    data.customFrequencyMonths =
      input.renewalFrequency === 'CUSTOM' && input.customFrequencyMonths
        ? input.customFrequencyMonths
        : null
  }
  if (renewalTouched) {
    data.paymentAlertFirstSentAt = null
    data.paymentAlertSecondSentAt = null
  }
  // Una edición directa de renovación sobre una licencia que pertenece a un
  // lote la "desengancha": la próxima renovación del lote ya no la toca (ver
  // license-batches.service.ts). La propia cascada del lote (source
  // 'batch-cascade') y la sincronización de contrato ('contract-sync') nunca
  // deben marcar este flag.
  if (source === 'direct' && renewalTouched && existing.batchId) {
    data.batchRenewalLinked = false
  }

  const updated = await prisma.software_licenses.update({
    where: { id: licenseId },
    data: data as never,
  })

  if (renewalTouched) {
    await prisma.license_renewal_history
      .create({
        data: {
          licenseId,
          previousRenewalDate: existing.renewalDate,
          newRenewalDate: updated.renewalDate,
          previousRenewalCost: existing.renewalCost,
          newRenewalCost: updated.renewalCost,
          previousFrequency: existing.renewalFrequency,
          newFrequency: updated.renewalFrequency,
          changedById,
        },
      })
      .catch((err: unknown) =>
        console.error(`[license_renewal_history] Error registrando cambio (source=${source}):`, err)
      )
  }

  return updated
}
