import { redirect } from 'next/navigation'

/**
 * La gestión de técnicos vive en el módulo de Usuarios (filtrar por rol).
 * La asignación técnico↔categoría se gestiona desde Categorías.
 * Esta ruta se mantiene para compatibilidad con bookmarks/links existentes.
 */
export default function TechniciansPage() {
  redirect('/admin/users')
}
