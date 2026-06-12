import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Ruta de verificación QR — /inventory/equipment/[id]/verify
 *
 * Esta ruta es generada en los códigos QR de los equipos.
 * Redirecciona a la página pública de verificación del equipo.
 */
export default async function EquipmentVerifyRedirectPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/inventory/equipment/public/${id}`)
}
