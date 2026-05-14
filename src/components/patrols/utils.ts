export function localDayToUTCDay(localDay: number, scheduledStartLocal: string): number {
  if (!scheduledStartLocal) return localDay
  const refDate = new Date(scheduledStartLocal)
  if (isNaN(refDate.getTime())) return localDay
  const localDayOfRef = refDate.getDay()
  const utcDayOfRef = refDate.getUTCDay()
  const dayOffset = (utcDayOfRef - localDayOfRef + 7) % 7
  return (localDay + dayOffset) % 7
}

export function utcDayToLocalDay(utcDay: number, scheduledStartLocal: string): number {
  if (!scheduledStartLocal) return utcDay
  const refDate = new Date(scheduledStartLocal)
  if (isNaN(refDate.getTime())) return utcDay
  const localDayOfRef = refDate.getDay()
  const utcDayOfRef = refDate.getUTCDay()
  const dayOffset = (utcDayOfRef - localDayOfRef + 7) % 7
  return (utcDay - dayOffset + 7) % 7
}

export function formatDateTimeLocal(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
