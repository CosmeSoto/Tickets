/**
 * Returns the renewal alert status for a license or contract.
 *
 * - 'expired'  → renewalDate is in the past
 * - 'warning'  → renewalDate is within the next 30 days
 * - 'none'     → renewalDate is null or more than 30 days away
 */
export function getRenewalAlertStatus(
  renewalDate: Date | null
): 'none' | 'warning' | 'expired' {
  if (renewalDate === null) return 'none';

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (renewalDate < now) return 'expired';
  if (renewalDate <= thirtyDaysFromNow) return 'warning';

  return 'none';
}
