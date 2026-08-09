/**
 * Returns the renewal alert status for a license or contract.
 *
 * - 'expired'  → renewalDate is in the past
 * - 'warning'  → renewalDate is within the next `warningDays` days
 * - 'none'     → renewalDate is null or beyond the warning window
 */
export function getRenewalAlertStatus(
  renewalDate: Date | null,
  warningDays = 30
): 'none' | 'warning' | 'expired' {
  if (renewalDate === null) return 'none'

  const days = Math.max(1, warningDays)
  const now = new Date()
  const warningUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  if (renewalDate < now) return 'expired'
  if (renewalDate <= warningUntil) return 'warning'

  return 'none'
}
