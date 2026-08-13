/**
 * Evita que capas dismissable de Radix (Dialog, Popover) cierren al interactuar
 * con el calendario o los Select de mes/año (portaleados fuera del Popover).
 */
export function isCalendarOrSelectInteraction(event: {
  target: EventTarget | null
}): boolean {
  const target = event.target as HTMLElement | null

  if (target) {
    if (
      target.closest('[data-slot=calendar]') ||
      target.closest('[data-radix-popper-content-wrapper]') ||
      target.closest('[data-radix-popover-content]') ||
      target.closest('[data-radix-select-content]') ||
      target.closest('[data-radix-select-viewport]') ||
      target.closest('.rdp-dropdown_root') ||
      target.tagName === 'SELECT' ||
      target.closest('select')
    ) {
      return true
    }
  }

  const active = document.activeElement
  if (active instanceof HTMLSelectElement && active.closest('[data-slot=calendar]')) {
    return true
  }

  return false
}

export function preventDismissOnCalendarInteraction(event: {
  target: EventTarget | null
  preventDefault: () => void
}): void {
  if (isCalendarOrSelectInteraction(event)) {
    event.preventDefault()
  }
}
