import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DeliveryActService } from '@/lib/services/delivery-act.service'

/**
 * GET /api/inventory/acts/[id]
 * Obtiene detalles de un acta de entrega
 * Requiere autenticación O token válido
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    // Intentar autenticación por sesión
    const session = await getServerSession(authOptions)

    // Si no hay sesión ni token, denegar acceso
    if (!session?.user && !token) {
      return NextResponse.json(
        { error: 'No autenticado. Proporciona credenciales o token de aceptación' },
        { status: 401 }
      )
    }

    // Obtener acta
    let act
    if (token) {
      // Acceso por token
      act = await DeliveryActService.getActByToken(token)
      
      if (!act || act.id !== id) {
        return NextResponse.json(
          { error: 'Acta no encontrada o token inválido' },
          { status: 404 }
        )
      }
    } else {
      // Acceso autenticado
      act = await DeliveryActService.getActById(id)
      
      if (!act) {
        return NextResponse.json(
          { error: 'Acta no encontrada' },
          { status: 404 }
        )
      }
    }

    // Verificar permisos: deliverer, receiver, ADMIN (cualquier admin), o gestor de inventario
    // Si se accedió por token, no hay sesión — el token ya es la autorización
    if (!token) {
      if (!session?.user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      }

      const userId = session.user.id
      const userRole = session.user.role
      const isSuperAdmin = (session.user as any).isSuperAdmin === true
      const canManage = await import('@/lib/inventory-access').then(m =>
        m.canManageInventory(userId, userRole)
      )

      const isDeliverer = (act as any).delivererInfo?.id === userId
      const isReceiver  = (act as any).receiverInfo?.id  === userId
      const isAdmin     = userRole === 'ADMIN'
      const isManager   = canManage

      if (!isDeliverer && !isReceiver && !isAdmin && !isManager) {
        return NextResponse.json(
          { error: 'No tienes permisos para ver esta acta' },
          { status: 403 }
        )
      }

      const accessLevel = isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : isManager ? 'manager' : 'participant'
      const isExpired = DeliveryActService.isActExpired(act)
      const canAccept = act.status === 'PENDING' && !isExpired

      return NextResponse.json({ act, canAccept, isExpired, accessLevel })
    }

    // Acceso por token — sin verificación de permisos adicional
    const isExpired = DeliveryActService.isActExpired(act)
    const canAccept = act.status === 'PENDING' && !isExpired

    return NextResponse.json({
      act,
      canAccept,
      isExpired,
      accessLevel: 'participant',
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/acts/[id]:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al obtener acta' },
      { status: 500 }
    )
  }
}
