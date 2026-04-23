import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { invalidateCache } from '@/lib/api-cache'

interface ParsedRow {
  nombre: string
  descripcion?: string
  nivel?: number
  padre?: string
  departamento?: string
  area?: string
  color?: string
  activa: boolean
  // Resueltos en validación
  _parentId?: string | null
  _departmentId?: string | null
  _level?: number
  _error?: string
}

interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: Array<{ row: number; nombre: string; error: string }>
  preview?: ParsedRow[]
}

function parseCSV(text: string): string[][] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  return lines.map(line => {
    const cols: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
        continue
      }
      current += ch
    }
    cols.push(current.trim())
    return cols
  })
}

function normalizeColor(color: string): string | null {
  if (!color) return null
  const hex = color.startsWith('#') ? color : `#${color}`
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : null
}

/**
 * POST /api/categories/import
 * Body: FormData con campo "file" (CSV) y "dryRun" (boolean)
 *
 * dryRun=true → solo valida y devuelve preview sin crear nada
 * dryRun=false → crea las categorías en una transacción
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') === 'true'
    const familyIdFilter = formData.get('familyId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede superar 2 MB' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío o no tiene datos válidos' },
        { status: 400 }
      )
    }

    // Detectar si la primera fila es encabezado
    const firstRow = rows[0].map(c => c.toLowerCase())
    const hasHeader = firstRow.includes('nombre') || firstRow.includes('name')
    const dataRows = hasHeader ? rows.slice(1) : rows

    // Mapear índices de columnas
    const headerRow = hasHeader
      ? firstRow
      : ['nombre', 'descripcion', 'nivel', 'padre', 'departamento', 'area', 'color', 'activa']
    const idx = {
      nombre: headerRow.indexOf('nombre') !== -1 ? headerRow.indexOf('nombre') : 0,
      descripcion: headerRow.indexOf('descripcion'),
      nivel: headerRow.indexOf('nivel'),
      padre: headerRow.indexOf('padre'),
      departamento: headerRow.indexOf('departamento'),
      area: headerRow.indexOf('area'),
      color: headerRow.indexOf('color'),
      activa: headerRow.indexOf('activa'),
    }

    if (dataRows.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 categorías por importación' }, { status: 400 })
    }

    // Cargar datos de referencia para resolver nombres
    const [existingCategories, departments, families] = await Promise.all([
      prisma.categories.findMany({
        select: { id: true, name: true, level: true, departmentId: true },
      }),
      prisma.departments.findMany({ select: { id: true, name: true, familyId: true } }),
      prisma.families.findMany({ select: { id: true, name: true, code: true } }),
    ])

    // Verificar familias permitidas para admin no-superadmin
    let allowedFamilyIds: Set<string> | null = null
    if (!isSuperAdmin) {
      const assignments = await prisma.admin_family_assignments.findMany({
        where: { adminId: session.user.id, isActive: true },
        select: { familyId: true },
      })
      if (assignments.length > 0) {
        allowedFamilyIds = new Set(assignments.map(a => a.familyId))
      }
    }

    // Parsear y validar filas
    const parsed: ParsedRow[] = []
    const errors: ImportResult['errors'] = []

    // Mapa de nombres de categorías ya existentes + las que vamos a crear (para resolver padres)
    const categoryNameMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]))
    const newCategoryNames = new Map<string, ParsedRow>() // nombre → fila parseada

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNum = i + (hasHeader ? 2 : 1)

      const nombre = row[idx.nombre]?.trim()
      if (!nombre) {
        errors.push({ row: rowNum, nombre: '(vacío)', error: 'El nombre es obligatorio' })
        continue
      }

      const descripcion =
        idx.descripcion >= 0 ? row[idx.descripcion]?.trim() || undefined : undefined
      const nivelRaw = idx.nivel >= 0 ? parseInt(row[idx.nivel]) : NaN
      const padreNombre = idx.padre >= 0 ? row[idx.padre]?.trim() || undefined : undefined
      const deptNombre =
        idx.departamento >= 0 ? row[idx.departamento]?.trim() || undefined : undefined
      const areaNombre = idx.area >= 0 ? row[idx.area]?.trim() || undefined : undefined
      const colorRaw = idx.color >= 0 ? row[idx.color]?.trim() || undefined : undefined
      const activaRaw = idx.activa >= 0 ? row[idx.activa]?.trim().toLowerCase() : 'true'

      // Resolver área/familia
      let resolvedFamilyId: string | null = null
      if (areaNombre) {
        const family = families.find(
          f =>
            f.name.toLowerCase() === areaNombre.toLowerCase() ||
            f.code.toLowerCase() === areaNombre.toLowerCase()
        )
        if (!family) {
          errors.push({ row: rowNum, nombre, error: `Área "${areaNombre}" no encontrada` })
          continue
        }
        resolvedFamilyId = family.id
      } else if (familyIdFilter) {
        resolvedFamilyId = familyIdFilter
      }

      // Verificar permisos de familia
      if (resolvedFamilyId && allowedFamilyIds && !allowedFamilyIds.has(resolvedFamilyId)) {
        errors.push({
          row: rowNum,
          nombre,
          error: `No tienes permiso para crear categorías en esa área`,
        })
        continue
      }

      // Resolver departamento
      let resolvedDeptId: string | null = null
      if (deptNombre) {
        const dept = departments.find(d => {
          const nameMatch = d.name.toLowerCase() === deptNombre.toLowerCase()
          const familyMatch = !resolvedFamilyId || d.familyId === resolvedFamilyId
          return nameMatch && familyMatch
        })
        if (!dept) {
          errors.push({
            row: rowNum,
            nombre,
            error: `Departamento "${deptNombre}" no encontrado${resolvedFamilyId ? ' en esa área' : ''}`,
          })
          continue
        }
        resolvedDeptId = dept.id
      }

      // Resolver padre
      let resolvedParentId: string | null = null
      let resolvedLevel = isNaN(nivelRaw) ? 1 : Math.min(Math.max(nivelRaw, 1), 4)

      if (padreNombre) {
        // Buscar en existentes
        const existingParent = categoryNameMap.get(padreNombre.toLowerCase())
        if (existingParent) {
          resolvedParentId = existingParent.id
          resolvedLevel = Math.min(existingParent.level + 1, 4)
        } else {
          // Buscar en las que vamos a crear en este mismo archivo
          const pendingParent = newCategoryNames.get(padreNombre.toLowerCase())
          if (pendingParent) {
            // Se resolverá en la segunda pasada
            resolvedParentId = `__pending__${padreNombre}`
          } else {
            errors.push({
              row: rowNum,
              nombre,
              error: `Categoría padre "${padreNombre}" no encontrada`,
            })
            continue
          }
        }
      }

      // Validar nivel máximo
      if (resolvedLevel > 4) {
        errors.push({ row: rowNum, nombre, error: 'El nivel máximo permitido es 4' })
        continue
      }

      const parsedRow: ParsedRow = {
        nombre,
        descripcion,
        nivel: resolvedLevel,
        padre: padreNombre,
        departamento: deptNombre,
        area: areaNombre,
        color: normalizeColor(colorRaw || '') || '#6B7280',
        activa: activaRaw !== 'false' && activaRaw !== '0' && activaRaw !== 'no',
        _parentId: resolvedParentId,
        _departmentId: resolvedDeptId,
        _level: resolvedLevel,
      }

      parsed.push(parsedRow)
      newCategoryNames.set(nombre.toLowerCase(), parsedRow)
    }

    const result: ImportResult = {
      total: dataRows.length,
      created: 0,
      skipped: errors.length,
      errors,
    }

    if (dryRun) {
      result.preview = parsed
      return NextResponse.json({ success: true, ...result })
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay filas válidas para importar', ...result },
        { status: 400 }
      )
    }

    // Crear en transacción — dos pasadas para resolver padres pendientes
    await prisma.$transaction(async tx => {
      const createdMap = new Map<string, string>() // nombre.lower → id creado

      // Primera pasada: crear categorías sin padre pendiente
      for (const row of parsed) {
        if (row._parentId?.startsWith('__pending__')) continue

        const created = await tx.categories.create({
          data: {
            id: randomUUID(),
            name: row.nombre,
            description: row.descripcion || null,
            level: row._level!,
            parentId: row._parentId || null,
            departmentId: row._departmentId || null,
            color: row.color || '#6B7280',
            isActive: row.activa,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
        createdMap.set(row.nombre.toLowerCase(), created.id)
        result.created++
      }

      // Segunda pasada: crear categorías con padre pendiente
      for (const row of parsed) {
        if (!row._parentId?.startsWith('__pending__')) continue

        const parentName = row._parentId.replace('__pending__', '')
        const parentId =
          createdMap.get(parentName.toLowerCase()) ||
          categoryNameMap.get(parentName.toLowerCase())?.id ||
          null

        const parentLevel = parentId
          ? createdMap.has(parentName.toLowerCase())
            ? (parsed.find(p => p.nombre.toLowerCase() === parentName.toLowerCase())?._level ?? 1)
            : (categoryNameMap.get(parentName.toLowerCase())?.level ?? 1)
          : 0

        await tx.categories.create({
          data: {
            id: randomUUID(),
            name: row.nombre,
            description: row.descripcion || null,
            level: Math.min(parentLevel + 1, 4),
            parentId: parentId,
            departmentId: row._departmentId || null,
            color: row.color || '#6B7280',
            isActive: row.activa,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
        result.created++
      }
    })

    // Invalidar caché de categorías
    try {
      await invalidateCache('categories:*')
    } catch {}

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[IMPORT] Error:', error)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
