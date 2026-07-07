import type { FormEvent } from 'react'

/**
 * Los modales de InlineCreateSelect viven en portal pero burbujean por el árbol React.
 * El formulario padre debe ignorar submits que no provienen de sí mismo.
 */
export function isDirectFormSubmit(e: FormEvent<HTMLFormElement>): boolean {
  return e.target === e.currentTarget
}
