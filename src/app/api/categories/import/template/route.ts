import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/categories/import/template
 * Descarga la plantilla CSV para importación masiva de categorías.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const headers = [
    'nombre',
    'descripcion',
    'nivel',
    'padre',
    'departamento',
    'area',
    'color',
    'activa',
  ]

  const examples = [
    [
      'Soporte Técnico',
      'Problemas de hardware y software',
      '1',
      '',
      'Sistemas',
      'TI',
      '#3B82F6',
      'true',
    ],
    [
      'Hardware',
      'Equipos físicos y periféricos',
      '2',
      'Soporte Técnico',
      'Sistemas',
      'TI',
      '#10B981',
      'true',
    ],
    [
      'Laptops',
      'Problemas con laptops y portátiles',
      '3',
      'Hardware',
      'Sistemas',
      'TI',
      '#F59E0B',
      'true',
    ],
    [
      'Software',
      'Aplicaciones y sistemas operativos',
      '2',
      'Soporte Técnico',
      'Sistemas',
      'TI',
      '#8B5CF6',
      'true',
    ],
    [
      'Redes',
      'Conectividad e infraestructura de red',
      '1',
      '',
      'Infraestructura',
      'TI',
      '#EF4444',
      'true',
    ],
  ]

  const csvLines = [
    '# Plantilla de importación de categorías',
    '# Columnas obligatorias: nombre',
    '# nivel: 1=Principal, 2=Subcategoría, 3=Especialidad, 4=Detalle (se infiere del padre si se omite)',
    '# padre: nombre exacto de la categoría padre (dejar vacío para nivel 1)',
    '# area: código o nombre del área/familia (ej: TI, RRHH)',
    '# color: código hexadecimal (ej: #3B82F6) — opcional',
    '# activa: true/false — por defecto true',
    headers.join(','),
    ...examples.map(row => row.join(',')),
  ]

  const csv = csvLines.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-categorias.csv"',
    },
  })
}
