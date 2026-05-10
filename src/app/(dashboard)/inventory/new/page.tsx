import { redirect } from 'next/navigation'

/**
 * /inventory/new → redirige al formulario original de creación de activos.
 * El sistema original en /inventory/equipment/new maneja el flujo completo:
 * familia → subtipo (EQUIPMENT/MRO/LICENSE) → formulario con todos los campos.
 */
export default function NewInventoryRedirect() {
  redirect('/inventory/equipment/new')
}
