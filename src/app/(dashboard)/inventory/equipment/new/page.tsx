import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { EquipmentFormWrapper } from '@/components/inventory/equipment-form-wrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function NewEquipmentPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Solo ADMIN y TECHNICIAN pueden crear equipos
  if (session.user.role === 'CLIENT') {
    redirect('/inventory')
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Equipo</CardTitle>
          <CardDescription>
            Registra un nuevo equipo en el inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentFormWrapper />
        </CardContent>
      </Card>
    </div>
  )
}

