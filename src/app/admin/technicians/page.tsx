import { redirect } from 'next/navigation'

/**
 * La gestión de técnicos se unificó en Familias > Pestaña Personal.
 * Esta ruta se mantiene para compatibilidad con bookmarks/links existentes.
 */
export default function TechniciansPage() {
  redirect('/admin/families')
}
