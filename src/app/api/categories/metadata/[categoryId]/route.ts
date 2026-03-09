import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { CategoryMetadata } from '@/features/category-selection/types';

/**
 * GET /api/categories/metadata/:categoryId
 * 
 * Retorna metadata contextual de una categoría para ayudar al usuario a tomar decisiones informadas
 * Incluye: departamento, tiempo de respuesta promedio, técnicos asignados, tickets recientes, popularidad
 * 
 * Params:
 * - categoryId: string (requerido) - ID de la categoría
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { categoryId } = await params;

    // Validar categoryId
    if (!categoryId) {
      return NextResponse.json(
        {
          success: false,
          message: 'El parámetro categoryId es requerido',
        },
        { status: 400 }
      );
    }

    // Obtener la categoría con su departamento
    const category = await prisma.categories.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
        name: true,
        departmentId: true,
        isActive: true,
        departments: {
          select: {
            name: true,
            color: true,
          },
        },
      },
    });

    // Validar que la categoría existe
    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: 'Categoría no encontrada',
        },
        { status: 404 }
      );
    }

    // Validar que la categoría está activa
    if (!category.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'Categoría no activa',
        },
        { status: 400 }
      );
    }

    // Calcular fecha de hace 30 días para tickets recientes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Ejecutar consultas en paralelo para mejor rendimiento
    const [
      assignedTechnicians,
      recentTickets,
      resolvedTicketsWithTime,
      totalTickets,
    ] = await Promise.all([
      // Contar técnicos asignados activos a esta categoría
      prisma.technician_assignments.count({
        where: {
          categoryId,
          isActive: true,
        },
      }),

      // Contar tickets recientes (últimos 30 días)
      prisma.tickets.count({
        where: {
          categoryId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),

      // Obtener tickets resueltos con tiempo de respuesta para calcular promedio
      prisma.tickets.findMany({
        where: {
          categoryId,
          status: 'RESOLVED',
          firstResponseAt: {
            not: null,
          },
        },
        select: {
          createdAt: true,
          firstResponseAt: true,
        },
        take: 100, // Limitar a últimos 100 tickets resueltos para cálculo
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Contar total de tickets para calcular popularidad
      prisma.tickets.count({
        where: {
          categoryId,
        },
      }),
    ]);

    // Calcular tiempo de respuesta promedio en horas
    let averageResponseTimeHours: number | null = null;
    if (resolvedTicketsWithTime.length > 0) {
      const totalResponseTimeMs = resolvedTicketsWithTime.reduce((sum, ticket) => {
        if (ticket.firstResponseAt) {
          const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
          return sum + responseTime;
        }
        return sum;
      }, 0);

      const averageResponseTimeMs = totalResponseTimeMs / resolvedTicketsWithTime.length;
      averageResponseTimeHours = Math.round((averageResponseTimeMs / (1000 * 60 * 60)) * 10) / 10; // Redondear a 1 decimal
    }

    // Calcular popularidad (0-100)
    // Basado en el número total de tickets comparado con un máximo esperado
    // Usamos una escala logarítmica para que categorías con muchos tickets no dominen
    const maxExpectedTickets = 1000; // Ajustar según necesidad
    const popularityScore = Math.min(
      100,
      Math.round((Math.log(totalTickets + 1) / Math.log(maxExpectedTickets + 1)) * 100)
    );

    // Construir respuesta de metadata
    const metadata: CategoryMetadata = {
      categoryId: category.id,
      departmentName: category.departments?.name || 'Sin departamento',
      departmentColor: category.departments?.color || '#6B7280',
      averageResponseTimeHours,
      assignedTechniciansCount: assignedTechnicians,
      recentTicketsCount: recentTickets,
      popularityScore,
    };

    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    console.error('Error in categories metadata API:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener metadata de la categoría',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
