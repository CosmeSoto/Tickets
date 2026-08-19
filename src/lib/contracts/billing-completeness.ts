/**
 * Valida si un contrato/suscripción tiene datos de pago suficientes
 * según el método de cobro (tarjeta, PayPal, cripto, etc.).
 */
export type PaymentMethodType =
  | 'CORPORATE_CARD'
  | 'PAYPAL'
  | 'CRYPTO'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'PROVIDER_INVOICE'
  | 'OTHER'

export interface BillingCompletenessInput {
  paymentMethodType?: PaymentMethodType | string | null
  paymentCardLast4?: string | null
  paymentCardBank?: string | null
  paymentAccountRef?: string | null
  billingAccountEmail?: string | null
  vendorAccountId?: string | null
  billingPortalUrl?: string | null
}

export function getBillingCompletenessIssues(data: BillingCompletenessInput): string[] {
  const method = (data.paymentMethodType ?? 'CORPORATE_CARD') as PaymentMethodType
  const issues: string[] = []

  switch (method) {
    case 'CORPORATE_CARD':
      if (!data.paymentCardLast4) issues.push('Faltan últimos 4 dígitos de tarjeta')
      if (!data.paymentCardBank) issues.push('Falta banco de la tarjeta')
      break
    case 'PAYPAL':
      if (!data.paymentAccountRef && !data.billingAccountEmail) {
        issues.push('Falta email/cuenta PayPal')
      }
      break
    case 'CRYPTO':
      if (!data.paymentAccountRef) issues.push('Falta dirección de wallet')
      break
    case 'BANK_TRANSFER':
      if (!data.paymentAccountRef && !data.paymentCardBank) {
        issues.push('Falta cuenta o banco para transferencia')
      }
      break
    case 'CHECK':
      if (!data.paymentAccountRef && !data.paymentCardBank) {
        issues.push('Falta banco, número de cheque o cuenta de referencia')
      }
      break
    case 'PROVIDER_INVOICE':
      if (!data.vendorAccountId && !data.billingAccountEmail) {
        issues.push('Falta ID de cuenta o email en proveedor')
      }
      break
    case 'OTHER':
      if (!data.billingAccountEmail && !data.paymentAccountRef && !data.billingPortalUrl) {
        issues.push('Faltan datos de contacto o referencia de pago')
      }
      break
    default:
      break
  }

  return issues
}

export function isBillingDataComplete(data: BillingCompletenessInput): boolean {
  return getBillingCompletenessIssues(data).length === 0
}

/** Métodos donde conviene tener portal o email de acceso para cancelar */
export function methodNeedsPortal(method?: PaymentMethodType | string | null): boolean {
  return ['PAYPAL', 'PROVIDER_INVOICE', 'OTHER', 'CORPORATE_CARD'].includes(
    method ?? 'CORPORATE_CARD'
  )
}
