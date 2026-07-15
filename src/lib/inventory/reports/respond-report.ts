import { NextResponse } from 'next/server'
import { generateReportPDF, toCSV } from '@/lib/inventory/report-utils'
import { exportReportXlsx } from './engine'
import { getTemplateBySlug } from './catalog'
import type { ReportResponse } from './types'

export interface ReportExportOptions {
  pdfTitle: string
  csvFilename: string
  pdfFilename: string
  pdfHeaders: string[]
  pdfRowKeys: string[]
  csvRowMapper: (row: Record<string, unknown>) => Record<string, unknown>
}

const DEFAULT_EXPORT: Partial<ReportExportOptions> = {
  csvFilename: 'reporte.csv',
  pdfFilename: 'reporte.pdf',
}

/** Configuración de exportación por plantilla (CSV/PDF). */
export const TEMPLATE_EXPORT: Record<string, ReportExportOptions> = {
  summary: {
    pdfTitle: '¿Qué tenemos? — Inventario Total',
    csvFilename: 'reporte-inventario.csv',
    pdfFilename: 'reporte-inventario.pdf',
    pdfHeaders: ['Familia', 'Subtipo', 'Cantidad', 'Valor Total', 'Estado'],
    pdfRowKeys: ['familia', 'subtipo', 'cantidad', 'valorTotal', 'estado'],
    csvRowMapper: r => ({
      Familia: r.familia,
      Subtipo: r.subtipo,
      Cantidad: r.cantidad,
      'Valor Total': r.valorTotal,
      Estado: r.estado,
    }),
  },
  assignments: {
    pdfTitle: '¿Quién tiene qué? — Asignaciones Activas',
    csvFilename: 'reporte-asignaciones.csv',
    pdfFilename: 'reporte-asignaciones.pdf',
    pdfHeaders: ['Código', 'Equipo', 'Familia', 'Estado', 'Usuario', 'Fecha Asignación'],
    pdfRowKeys: [
      'equipmentCode',
      'equipmentName',
      'familia',
      'estado',
      'usuarioAsignado',
      'fechaAsignacion',
    ],
    csvRowMapper: r => ({
      Código: r.equipmentCode,
      Equipo: r.equipmentName,
      Familia: r.familia,
      Estado: r.estado,
      'Usuario Asignado': r.usuarioAsignado,
      Departamento: r.departamento,
      'Ubicación Física': r.ubicacionFisica,
      'Fecha Asignación': r.fechaAsignacion,
      'Fecha Fin': r.fechaFin,
      'Tipo Asignación': r.tipoAsignacion,
    }),
  },
  expiring: {
    pdfTitle: '¿Qué está por vencer?',
    csvFilename: 'reporte-vencimientos.csv',
    pdfFilename: 'reporte-vencimientos.pdf',
    pdfHeaders: ['Tipo', 'Nombre', 'Código', 'Familia', 'Fecha Vencimiento', 'Días', 'Urgencia'],
    pdfRowKeys: [
      'tipo',
      'nombre',
      'codigo',
      'familia',
      'fechaVencimiento',
      'diasRestantes',
      'urgencia',
    ],
    csvRowMapper: r => ({
      Tipo: r.tipo,
      Nombre: r.nombre,
      Código: r.codigo,
      Familia: r.familia,
      'Fecha Vencimiento': r.fechaVencimiento,
      'Días Restantes': r.diasRestantes,
      Urgencia: r.urgencia,
    }),
  },
  maintenance: {
    pdfTitle: 'Historial de Mantenimientos',
    csvFilename: 'reporte-mantenimientos.csv',
    pdfFilename: 'reporte-mantenimientos.pdf',
    pdfHeaders: ['Fecha', 'Equipo', 'Código', 'Familia', 'Tipo', 'Estado', 'Técnico', 'Costo'],
    pdfRowKeys: [
      'fecha',
      'equipo',
      'codigoEquipo',
      'familia',
      'tipo',
      'estado',
      'tecnico',
      'costo',
    ],
    csvRowMapper: r => ({
      Fecha: r.fecha,
      Equipo: r.equipo,
      Código: r.codigoEquipo,
      Familia: r.familia,
      Tipo: r.tipo,
      Estado: r.estado,
      Descripción: r.descripcion,
      Técnico: r.tecnico,
      Costo: r.costo,
      'Fecha Completado': r.fechaCompletado,
    }),
  },
  'stock-movements': {
    pdfTitle: '¿Qué se ha consumido? — Movimientos de Stock',
    csvFilename: 'reporte-movimientos-stock.csv',
    pdfFilename: 'reporte-movimientos-stock.pdf',
    pdfHeaders: ['Fecha', 'Consumible', 'Familia', 'Tipo', 'Cantidad', 'Unidad', 'Usuario'],
    pdfRowKeys: ['fecha', 'consumible', 'familia', 'tipo', 'cantidad', 'unidad', 'usuario'],
    csvRowMapper: r => ({
      Fecha: r.fecha,
      Consumible: r.consumible,
      Familia: r.familia,
      Tipo: r.tipo,
      Cantidad: r.cantidad,
      Unidad: r.unidad,
      Motivo: r.motivo,
      Usuario: r.usuario,
    }),
  },
  decommissioned: {
    pdfTitle: '¿Qué se ha dado de baja?',
    csvFilename: 'reporte-bajas.csv',
    pdfFilename: 'reporte-bajas.pdf',
    pdfHeaders: ['Folio', 'Fecha Baja', 'Tipo', 'Nombre', 'Familia', 'Motivo', 'Aprobado Por'],
    pdfRowKeys: [
      'folio',
      'fechaBaja',
      'tipoActivo',
      'nombreActivo',
      'familia',
      'motivo',
      'aprobadoPor',
    ],
    csvRowMapper: r => ({
      Folio: r.folio,
      'Fecha Baja': r.fechaBaja,
      'Tipo Activo': r.tipoActivo,
      Nombre: r.nombreActivo,
      Código: r.codigoActivo,
      Familia: r.familia,
      Motivo: r.motivo,
      'Solicitado Por': r.solicitadoPor,
      'Aprobado Por': r.aprobadoPor,
    }),
  },
  locations: {
    pdfTitle: '¿Dónde están los equipos?',
    csvFilename: 'reporte-ubicaciones.csv',
    pdfFilename: 'reporte-ubicaciones.pdf',
    pdfHeaders: ['Código', 'Equipo', 'Familia', 'Estado', 'Ubicación Física', 'Usuario', 'Departamento'],
    pdfRowKeys: [
      'equipmentCode',
      'equipmentName',
      'familia',
      'estado',
      'ubicacionFisica',
      'usuarioAsignado',
      'departamento',
    ],
    csvRowMapper: r => ({
      Código: r.equipmentCode,
      Equipo: r.equipmentName,
      Familia: r.familia,
      Estado: r.estado,
      'Ubicación Física': r.ubicacionFisica,
      Bodega: r.bodega,
      'Usuario Asignado': r.usuarioAsignado,
      Departamento: r.departamento,
      'Fecha Asignación': r.fechaAsignacion,
    }),
  },
  sales: {
    pdfTitle: '¿Qué se ha vendido?',
    csvFilename: 'reporte-ventas.csv',
    pdfFilename: 'reporte-ventas.pdf',
    pdfHeaders: ['Código', 'Equipo', 'Comprador', 'Precio Venta', 'Resultado', 'Fecha', 'Estado'],
    pdfRowKeys: ['codigo', 'equipo', 'comprador', 'precioVenta', 'resultado', 'fechaVenta', 'estado'],
    csvRowMapper: r => ({
      Código: r.codigo,
      Equipo: r.equipo,
      Tipo: r.tipo,
      'N° Serie': r.serie,
      Comprador: r.comprador,
      Empresa: r.empresa,
      'RUC/Cédula': r.ruc,
      'Precio Venta': r.precioVenta,
      'Precio Compra': r.precioCompra,
      'Valor Libro': r.valorLibro,
      Resultado: r.resultado,
      'Fecha Venta': r.fechaVenta,
      'Forma Pago': r.formaPago,
      Factura: r.factura,
      Estado: r.estado,
      'Solicitado Por': r.solicitadoPor,
      'Aprobado Por': r.aprobadoPor,
    }),
  },
  'financial-summary': {
    pdfTitle: 'Resumen Financiero Global',
    csvFilename: 'reporte-financiero-global.csv',
    pdfFilename: 'reporte-financiero-global.pdf',
    pdfHeaders: ['Familia', 'Equipos', 'Valor Equipos', 'Renta/Mes', 'Licencias', 'Valor Total'],
    pdfRowKeys: ['familia', 'equiposActivos', 'valorEquipos', 'costoRentaMensual', 'licencias', 'valorTotal'],
    csvRowMapper: r => ({
      Familia: r.familia,
      'Equipos Activos': r.equiposActivos,
      'Valor Equipos': r.valorEquipos,
      'Renta/Mes': r.costoRentaMensual,
      'Renta/Año': r.costoRentaAnual,
      Licencias: r.licencias,
      'Valor Licencias': r.valorLicencias,
      Materiales: r.materiales,
      'Valor Materiales': r.valorMateriales,
      Mantenimiento: r.costoMantenimiento,
      'Valor Total': r.valorTotal,
    }),
  },
  'by-model': {
    pdfTitle: 'Inventario por Modelo',
    csvFilename: 'reporte-por-modelo.csv',
    pdfFilename: 'reporte-por-modelo.pdf',
    pdfHeaders: ['Modelo', 'Tipo', 'Total', 'Disponibles', 'Asignados', 'Valor Total'],
    pdfRowKeys: ['modelo', 'tipo', 'total', 'disponibles', 'asignados', 'valorTotal'],
    csvRowMapper: r => ({
      Modelo: r.modelo,
      Tipo: r.tipo ?? r.mantenimientos,
      SKU: r.sku,
      Total: r.total ?? r.mantenimientos,
      Disponibles: r.disponibles,
      Asignados: r.asignados,
      Mantenimiento: r.mantenimiento,
      Retirados: r.retirados,
      'Valor Total': r.valorTotal ?? r.costoTotal,
      'Costo Promedio': r.costoPromedio,
    }),
  },
  'by-batch': {
    pdfTitle: 'Inventario por Lote',
    csvFilename: 'reporte-por-lote.csv',
    pdfFilename: 'reporte-por-lote.pdf',
    pdfHeaders: ['Lote', 'Modelo', 'Proveedor', 'Equipos', 'Disponibles', 'Precio Total'],
    pdfRowKeys: ['lote', 'modelo', 'proveedor', 'equiposRegistrados', 'disponibles', 'precioTotal'],
    csvRowMapper: r => ({
      Lote: r.lote,
      Modelo: r.modelo,
      Proveedor: r.proveedor,
      'Cantidad lote': r.cantidadLote,
      'Equipos registrados': r.equiposRegistrados,
      Disponibles: r.disponibles,
      Asignados: r.asignados,
      'Precio unitario': r.precioUnitario,
      'Precio total': r.precioTotal,
      'Fecha compra': r.fechaCompra,
    }),
  },
}

export async function respondWithReportFormat(
  slug: string,
  response: ReportResponse,
  format?: string | null
): Promise<NextResponse> {
  if (format === 'csv') {
    const exportCfg = TEMPLATE_EXPORT[slug]
    const csvRows = response.data.map(row =>
      exportCfg?.csvRowMapper(row) ?? row
    )
    const csv = toCSV(csvRows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportCfg?.csvFilename ?? DEFAULT_EXPORT.csvFilename}"`,
      },
    })
  }

  if (format === 'pdf') {
    const exportCfg = TEMPLATE_EXPORT[slug]
    const template = getTemplateBySlug(slug)
    const pdfTitle = exportCfg?.pdfTitle ?? template?.name ?? slug
    const headers = exportCfg?.pdfHeaders ?? (response.data[0] ? Object.keys(response.data[0]) : [])
    const pdfRows = response.data.map(row =>
      (exportCfg?.pdfRowKeys ?? headers).map(key => String(row[key] ?? '—'))
    )
    const pdfBuffer = await generateReportPDF(pdfTitle, response.summary, headers, pdfRows)
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportCfg?.pdfFilename ?? DEFAULT_EXPORT.pdfFilename}"`,
      },
    })
  }

  if (format === 'xlsx') {
    const exportCfg = TEMPLATE_EXPORT[slug]
    const template = getTemplateBySlug(slug)
    const rows = response.data.map(row => exportCfg?.csvRowMapper(row) ?? row)
    const title = exportCfg?.pdfTitle ?? template?.name ?? slug
    const buffer = await exportReportXlsx(rows, title)
    const baseName = (exportCfg?.csvFilename ?? DEFAULT_EXPORT.csvFilename).replace(/\.csv$/i, '')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
      },
    })
  }

  return NextResponse.json(response)
}
