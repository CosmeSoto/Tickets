/** Contador de Select de mes/año abiertos dentro del calendario (evita cerrar el Popover padre). */
let openCalendarSelectCount = 0

export function calendarSelectOpened(): void {
  openCalendarSelectCount += 1
}

export function calendarSelectClosed(): void {
  openCalendarSelectCount = Math.max(0, openCalendarSelectCount - 1)
}

export function isCalendarSelectOpen(): boolean {
  return openCalendarSelectCount > 0
}
