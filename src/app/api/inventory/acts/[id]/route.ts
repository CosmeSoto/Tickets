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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
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

      // Verificar permisos: solo deliverer, receiver o ADMIN pueden ver el acta
      const userId = session!.user.id
      const userRole = session!.user.role
      
      const isDeliverer = act.delivererInfo.id === userId
      const isReceiver = act.receiverInfo.id === userId
      const isAdmin = userRole === 'ADMIN'

      if (!isDeliverer && !isReceiver && !isAdmin) {
        return NextResponse.json(
          { error: 'No tienes permisos para ver esta acta' },
          { status: 403 }
        )
      }
    }

    // Verificar si está expirada
    const isExpired = DeliveryActService.isActExpired(act)
    const canAccept = act.status === 'PENDING' && !isExpired

    return NextResponse.json({
      act,
      canAccept,
      isExpired,
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
