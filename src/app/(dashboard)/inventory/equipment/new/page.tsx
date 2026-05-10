import { redirect } from 'next/navigation'

// Esta ruta fue reemplazada por /inventory/new (formulario unificado)
export default function EquipmentNewRedirect() {
  redirect('/inventory/new')
}
