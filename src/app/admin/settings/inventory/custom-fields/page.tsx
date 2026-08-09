import { redirect } from 'next/navigation'

/**
 * @deprecated Campos por familia → atributos por tipo (Catálogos en /inventory/settings).
 */
export default function CustomFieldsPage() {
  redirect('/inventory/settings')
}
