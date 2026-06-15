import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Ruta de verificación QR — /inventory/equipment/[id]/verify
 *
 * Esta ruta es generada en los códigos QR de los equipos.
 * Redirecciona a la página pública de verificación del equipo.
 * Nota: La ruta pública está bajo (public) route group para evitar
 * heredar el layout de /inventory que requiere sesión.
 */
export default async function EquipmentVerifyRedirectPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/verify/equipment/${id}`)
}
