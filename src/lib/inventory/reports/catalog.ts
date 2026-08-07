import type {
  InventoryReportRole,
  ReportCategoryDef,
  ReportDatasetDef,
  ReportFilterDef,
  ReportTemplateDef,
} from './types'
import { DATASET_GROUP_BY } from './group-by'

export const ALL_FILTER = 'all'

export const REPORT_CATEGORIES: ReportCategoryDef[] = [
  {
    id: 'inventory',
    name: 'Inventario',
    description: 'Activos, stock y ubicaciones',
  },
  {
    id: 'operations',
    name: 'Operaciones',
    description: 'Asignaciones, mantenimiento y movimientos',
  },
  {
    id: 'contracts',
    name: 'Contratos y suscripciones',
    description: 'Vencimientos, facturación y custodia',
  },
  {
    id: 'financial',
    name: 'Financiero',
    description: 'Valorización, ventas y costos',
  },
  {
    id: 'analysis',
    name: 'Análisis',
    description: 'Vistas cruzadas y exploración ad hoc',
  },
]

const DATE_RANGE_FILTERS: ReportFilterDef[] = [
  { key: 'dateFrom', label: 'Desde', type: 'date' },
  { key: 'dateTo', label: 'Hasta', type: 'date' },
]

export const REPORT_TEMPLATES: ReportTemplateDef[] = [
  {
    slug: 'summary',
    categoryId: 'inventory',
    name: '¿Qué tenemos?',
    description: 'Inventario total por familia y subtipo con conteos y valor estimado',
    icon: 'Package',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'subtype',
        label: 'Tipo de activo',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'EQUIPMENT', label: 'Equipos' },
          { value: 'MRO', label: 'Suministros' },
          { value: 'LICENSE', label: 'Licencias' },
        ],
      },
    ],
  },
  {
    slug: 'locations',
    categoryId: 'inventory',
    name: '¿Dónde están los equipos?',
    description: 'Ubicación física, bodega y responsable de cada equipo',
    icon: 'MapPin',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'onlyWithLocation',
        label: 'Mostrar',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos los equipos' },
          { value: 'true', label: 'Solo con ubicación registrada' },
        ],
      },
    ],
  },
  {
    slug: 'assignments',
    categoryId: 'operations',
    name: '¿Quién tiene qué?',
    description: 'Asignaciones activas con usuario, departamento y fechas',
    icon: 'Users',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: DATE_RANGE_FILTERS,
  },
  {
    slug: 'maintenance',
    categoryId: 'operations',
    name: 'Historial de mantenimientos',
    description: 'Registros de mantenimiento por equipo y período con costos',
    icon: 'Wrench',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'COMPLETED', label: 'Completados' },
          { value: 'SCHEDULED', label: 'Programados' },
          { value: 'REQUESTED', label: 'Solicitados' },
          { value: 'CANCELLED', label: 'Cancelados' },
        ],
      },
    ],
  },
  {
    slug: 'stock-movements',
    categoryId: 'operations',
    name: '¿Qué se ha consumido?',
    description: 'Movimientos de stock de suministros por período',
    icon: 'ShoppingCart',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'type',
        label: 'Tipo de movimiento',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'ENTRY', label: 'Entradas' },
          { value: 'EXIT', label: 'Salidas' },
          { value: 'ADJUSTMENT', label: 'Ajustes' },
        ],
      },
    ],
  },
  {
    slug: 'decommissioned',
    categoryId: 'operations',
    name: '¿Qué se ha dado de baja?',
    description: 'Activos retirados con motivo, fecha y responsable',
    icon: 'Trash2',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: DATE_RANGE_FILTERS,
  },
  {
    slug: 'expiring',
    categoryId: 'contracts',
    name: '¿Qué está por vencer?',
    description: 'Contratos, licencias, garantías y arrendamientos por urgencia',
    icon: 'Clock',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'days',
        label: 'Horizonte',
        type: 'select',
        defaultValue: '90',
        options: [
          { value: '30', label: 'Próximos 30 días' },
          { value: '60', label: 'Próximos 60 días' },
          { value: '90', label: 'Próximos 90 días' },
          { value: '180', label: 'Próximos 6 meses' },
          { value: '365', label: 'Próximo año' },
        ],
      },
    ],
  },
  {
    slug: 'sales',
    categoryId: 'financial',
    name: '¿Qué se ha vendido?',
    description: 'Ventas con precio, comprador y resultado vs valor libro',
    icon: 'DollarSign',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'APPROVED', label: 'Aprobadas' },
          { value: 'PENDING', label: 'Pendientes' },
          { value: 'REJECTED', label: 'Rechazadas' },
        ],
      },
    ],
  },
  {
    slug: 'financial-summary',
    categoryId: 'financial',
    name: 'Resumen Financiero Global',
    description: 'Valor total del inventario, rentas y mantenimiento por familia',
    icon: 'BarChart3',
    roles: ['SUPER_ADMIN'],
    superAdminOnly: true,
    filters: [],
  },
  {
    slug: 'by-model',
    categoryId: 'analysis',
    name: 'Inventario por modelo',
    description: 'Agregación de equipos o mantenimientos agrupados por modelo',
    icon: 'Layers',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'reportType',
        label: 'Tipo de reporte',
        type: 'select',
        defaultValue: 'inventory',
        options: [
          { value: 'inventory', label: 'Equipos por modelo' },
          { value: 'maintenance', label: 'Mantenimientos por modelo' },
        ],
      },
      ...DATE_RANGE_FILTERS,
      {
        key: 'modelId',
        label: 'ID modelo',
        type: 'text',
        placeholder: 'Filtrar por modelo específico...',
      },
    ],
  },
  {
    slug: 'by-batch',
    categoryId: 'analysis',
    name: 'Inventario por lote',
    description: 'Equipos agrupados por lote de compra con proveedor y costos',
    icon: 'Boxes',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'batchId',
        label: 'ID lote',
        type: 'text',
        placeholder: 'Filtrar por lote específico...',
      },
      {
        key: 'supplierId',
        label: 'ID proveedor',
        type: 'text',
        placeholder: 'Filtrar por proveedor...',
      },
    ],
  },
]

export const REPORT_DATASETS: ReportDatasetDef[] = [
  {
    id: 'equipment',
    categoryId: 'inventory',
    name: 'Equipos',
    description: 'Listado detallado de equipos con estado, adquisición y valor',
    icon: 'HardDrive',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'AVAILABLE', label: 'Disponible' },
          { value: 'ASSIGNED', label: 'Asignado' },
          { value: 'MAINTENANCE', label: 'Mantenimiento' },
          { value: 'FOR_SALE', label: 'En venta' },
          { value: 'RETIRED', label: 'Retirado' },
        ],
      },
      {
        key: 'acquisitionMode',
        label: 'Modalidad',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todas' },
          { value: 'FIXED_ASSET', label: 'Activo fijo' },
          { value: 'RENTAL', label: 'Arrendamiento' },
          { value: 'LOAN', label: 'Comodato' },
        ],
      },
      { key: 'search', label: 'Buscar', type: 'text', placeholder: 'Código, serie, marca...' },
    ],
    columns: [
      { key: 'codigo', label: 'Código', defaultVisible: true },
      { key: 'equipo', label: 'Equipo', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'tipo', label: 'Tipo', defaultVisible: true },
      { key: 'estado', label: 'Estado', defaultVisible: true },
      { key: 'modalidad', label: 'Modalidad', defaultVisible: true },
      { key: 'ubicacion', label: 'Ubicación', defaultVisible: true },
      { key: 'asignadoA', label: 'Asignado a', defaultVisible: true },
      { key: 'precioCompra', label: 'Precio compra', defaultVisible: false },
      { key: 'rentaMensual', label: 'Renta/mes', defaultVisible: false },
      { key: 'fechaCompra', label: 'Fecha compra', defaultVisible: false },
      { key: 'finContrato', label: 'Fin contrato', defaultVisible: false },
    ],
  },
  {
    id: 'licenses',
    categoryId: 'inventory',
    name: 'Licencias de software',
    description: 'Licencias con costos, vigencia y asignación',
    icon: 'Key',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'expiringDays',
        label: 'Vence en (días)',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Cualquier vigencia' },
          { value: '30', label: '30 días' },
          { value: '60', label: '60 días' },
          { value: '90', label: '90 días' },
          { value: 'expired', label: 'Ya vencidas' },
        ],
      },
      { key: 'search', label: 'Buscar', type: 'text', placeholder: 'Nombre, proveedor...' },
    ],
    columns: [
      { key: 'nombre', label: 'Nombre', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'tipo', label: 'Tipo', defaultVisible: true },
      { key: 'proveedor', label: 'Proveedor', defaultVisible: true },
      { key: 'costo', label: 'Costo', defaultVisible: true },
      { key: 'renovacion', label: 'Costo renovación', defaultVisible: false },
      { key: 'vencimiento', label: 'Vencimiento', defaultVisible: true },
      { key: 'alcance', label: 'Alcance', defaultVisible: false },
    ],
  },
  {
    id: 'consumables',
    categoryId: 'inventory',
    name: 'Suministros',
    description: 'Stock de suministros con mínimos y valor',
    icon: 'Boxes',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'stockLevel',
        label: 'Nivel de stock',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'low', label: 'Bajo mínimo' },
          { value: 'ok', label: 'Normal' },
        ],
      },
      { key: 'search', label: 'Buscar', type: 'text', placeholder: 'Nombre, código...' },
    ],
    columns: [
      { key: 'nombre', label: 'Material', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'stock', label: 'Stock', defaultVisible: true },
      { key: 'minimo', label: 'Mínimo', defaultVisible: true },
      { key: 'unidad', label: 'Unidad', defaultVisible: true },
      { key: 'costoUnitario', label: 'Costo unit.', defaultVisible: true },
      { key: 'valorTotal', label: 'Valor total', defaultVisible: true },
      { key: 'estado', label: 'Estado', defaultVisible: false },
    ],
  },
  {
    id: 'contracts',
    categoryId: 'contracts',
    name: 'Contratos y suscripciones',
    description: 'Contratos de negocio con facturación, custodio y vigencia',
    icon: 'FileText',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'ACTIVE', label: 'Activos' },
          { value: 'DRAFT', label: 'Borrador' },
          { value: 'EXPIRED', label: 'Vencidos' },
          { value: 'CANCELLED', label: 'Cancelados' },
        ],
      },
      {
        key: 'category',
        label: 'Categoría',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todas' },
          { value: 'SERVICE', label: 'Servicio' },
          { value: 'SUBSCRIPTION', label: 'Suscripción' },
          { value: 'RENTAL', label: 'Arrendamiento' },
          { value: 'SOFTWARE', label: 'Software' },
        ],
      },
      { key: 'search', label: 'Buscar', type: 'text', placeholder: 'Número, nombre...' },
    ],
    columns: [
      { key: 'numero', label: 'N° contrato', defaultVisible: true },
      { key: 'nombre', label: 'Nombre', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'categoria', label: 'Categoría', defaultVisible: true },
      { key: 'estado', label: 'Estado', defaultVisible: true },
      { key: 'proveedor', label: 'Proveedor', defaultVisible: true },
      { key: 'custodio', label: 'Custodio', defaultVisible: true },
      { key: 'inicio', label: 'Inicio', defaultVisible: true },
      { key: 'fin', label: 'Fin', defaultVisible: true },
      { key: 'costoMensual', label: 'Costo/mes', defaultVisible: true },
      { key: 'ciclo', label: 'Ciclo fact.', defaultVisible: false },
    ],
  },
  {
    id: 'assignments',
    categoryId: 'operations',
    name: 'Asignaciones activas',
    description: 'Quién tiene qué equipo actualmente',
    icon: 'UserCheck',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: DATE_RANGE_FILTERS,
    columns: [
      { key: 'equipo', label: 'Equipo', defaultVisible: true },
      { key: 'codigo', label: 'Código', defaultVisible: true },
      { key: 'usuario', label: 'Usuario', defaultVisible: true },
      { key: 'departamento', label: 'Departamento', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'fechaAsignacion', label: 'Fecha asignación', defaultVisible: true },
      { key: 'ubicacion', label: 'Ubicación', defaultVisible: false },
    ],
  },
  {
    id: 'maintenance',
    categoryId: 'operations',
    name: 'Mantenimientos',
    description: 'Historial y programación de mantenimientos',
    icon: 'Wrench',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'COMPLETED', label: 'Completados' },
          { value: 'SCHEDULED', label: 'Programados' },
          { value: 'REQUESTED', label: 'Solicitados' },
          { value: 'CANCELLED', label: 'Cancelados' },
        ],
      },
    ],
    columns: [
      { key: 'equipo', label: 'Equipo', defaultVisible: true },
      { key: 'tipo', label: 'Tipo', defaultVisible: true },
      { key: 'estado', label: 'Estado', defaultVisible: true },
      { key: 'fecha', label: 'Fecha', defaultVisible: true },
      { key: 'tecnico', label: 'Técnico', defaultVisible: true },
      { key: 'costo', label: 'Costo', defaultVisible: true },
      { key: 'descripcion', label: 'Descripción', defaultVisible: false },
    ],
  },
  {
    id: 'sales',
    categoryId: 'financial',
    name: 'Ventas de equipos',
    description: 'Transacciones de venta con resultado financiero',
    icon: 'TrendingUp',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'APPROVED', label: 'Aprobadas' },
          { value: 'PENDING', label: 'Pendientes' },
          { value: 'REJECTED', label: 'Rechazadas' },
        ],
      },
    ],
    columns: [
      { key: 'codigo', label: 'Código', defaultVisible: true },
      { key: 'equipo', label: 'Equipo', defaultVisible: true },
      { key: 'comprador', label: 'Comprador', defaultVisible: true },
      { key: 'precioVenta', label: 'Precio venta', defaultVisible: true },
      { key: 'valorLibro', label: 'Valor libro', defaultVisible: true },
      { key: 'resultado', label: 'Resultado', defaultVisible: true },
      { key: 'fechaVenta', label: 'Fecha', defaultVisible: true },
      { key: 'estado', label: 'Estado', defaultVisible: true },
    ],
  },
  {
    id: 'rentals',
    categoryId: 'financial',
    name: 'Equipos en arrendamiento',
    description: 'Rentas activas con costo mensual y vencimiento de contrato',
    icon: 'Repeat',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'expiringDays',
        label: 'Contrato vence en',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Cualquiera' },
          { value: '30', label: '30 días' },
          { value: '60', label: '60 días' },
          { value: '90', label: '90 días' },
        ],
      },
    ],
    columns: [
      { key: 'codigo', label: 'Código', defaultVisible: true },
      { key: 'equipo', label: 'Equipo', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'contrato', label: 'N° contrato', defaultVisible: true },
      { key: 'rentaMensual', label: 'Renta/mes', defaultVisible: true },
      { key: 'inicio', label: 'Inicio', defaultVisible: true },
      { key: 'fin', label: 'Fin', defaultVisible: true },
      { key: 'asignadoA', label: 'Asignado a', defaultVisible: false },
    ],
  },
  {
    id: 'expiring',
    categoryId: 'contracts',
    name: 'Próximos vencimientos',
    description: 'Licencias, garantías, suministros y rentas por urgencia',
    icon: 'Clock',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'days',
        label: 'Horizonte',
        type: 'select',
        defaultValue: '90',
        options: [
          { value: '30', label: 'Próximos 30 días' },
          { value: '60', label: 'Próximos 60 días' },
          { value: '90', label: 'Próximos 90 días' },
          { value: '180', label: 'Próximos 180 días' },
        ],
      },
    ],
    columns: [
      { key: 'tipo', label: 'Tipo', defaultVisible: true },
      { key: 'nombre', label: 'Nombre', defaultVisible: true },
      { key: 'codigo', label: 'Código', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'fechaVencimiento', label: 'Vencimiento', defaultVisible: true },
      { key: 'diasRestantes', label: 'Días restantes', defaultVisible: true },
      { key: 'urgencia', label: 'Urgencia', defaultVisible: true },
    ],
  },
  {
    id: 'stock-movements',
    categoryId: 'operations',
    name: 'Movimientos de stock',
    description: 'Entradas, salidas y ajustes de suministros',
    icon: 'ShoppingCart',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      {
        key: 'type',
        label: 'Tipo de movimiento',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos' },
          { value: 'ENTRY', label: 'Entradas' },
          { value: 'EXIT', label: 'Salidas' },
          { value: 'ADJUSTMENT', label: 'Ajustes' },
        ],
      },
    ],
    columns: [
      { key: 'fecha', label: 'Fecha', defaultVisible: true },
      { key: 'consumible', label: 'Suministro', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'tipo', label: 'Tipo', defaultVisible: true },
      { key: 'cantidad', label: 'Cantidad', defaultVisible: true },
      { key: 'unidad', label: 'Unidad', defaultVisible: true },
      { key: 'motivo', label: 'Motivo', defaultVisible: false },
      { key: 'usuario', label: 'Usuario', defaultVisible: true },
    ],
  },
  {
    id: 'locations',
    categoryId: 'inventory',
    name: 'Ubicaciones de equipos',
    description: 'Ubicación física, bodega y responsable por equipo',
    icon: 'MapPin',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      {
        key: 'onlyWithLocation',
        label: 'Mostrar',
        type: 'select',
        options: [
          { value: ALL_FILTER, label: 'Todos los equipos' },
          { value: 'true', label: 'Solo con ubicación registrada' },
        ],
      },
    ],
    columns: [
      { key: 'equipmentCode', label: 'Código', defaultVisible: true },
      { key: 'equipmentName', label: 'Equipo', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'estado', label: 'Estado', defaultVisible: true },
      { key: 'ubicacionFisica', label: 'Ubicación', defaultVisible: true },
      { key: 'bodega', label: 'Bodega', defaultVisible: false },
      { key: 'usuarioAsignado', label: 'Asignado a', defaultVisible: true },
      { key: 'departamento', label: 'Departamento', defaultVisible: false },
    ],
  },
  {
    id: 'decommissions',
    categoryId: 'operations',
    name: 'Bajas de activos',
    description: 'Actas de baja con motivo, fecha y responsables',
    icon: 'Trash2',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    filters: [
      ...DATE_RANGE_FILTERS,
      { key: 'reason', label: 'Motivo', type: 'text', placeholder: 'Filtrar por motivo...' },
    ],
    columns: [
      { key: 'folio', label: 'Folio', defaultVisible: true },
      { key: 'fechaBaja', label: 'Fecha baja', defaultVisible: true },
      { key: 'tipoActivo', label: 'Tipo', defaultVisible: true },
      { key: 'nombreActivo', label: 'Activo', defaultVisible: true },
      { key: 'codigoActivo', label: 'Código', defaultVisible: true },
      { key: 'familia', label: 'Familia', defaultVisible: true },
      { key: 'motivo', label: 'Motivo', defaultVisible: true },
      { key: 'solicitadoPor', label: 'Solicitado por', defaultVisible: false },
      { key: 'aprobadoPor', label: 'Aprobado por', defaultVisible: false },
    ],
  },
]

export interface ReportRoleCapabilities {
  label: string
  description: string
  dataScope: string
  templateAccess: string
  canSaveReports: boolean
  canScheduleEmail: boolean
  canPinWidgets: boolean
}

/** Quién puede entrar al módulo de reportes (debe coincidir con scope.ts). */
export function hasInventoryReportsAccess(
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): boolean {
  return isSuperAdmin || role === 'ADMIN' || canManageInventory
}

export function getReportRoleCapabilities(userRole: InventoryReportRole): ReportRoleCapabilities {
  switch (userRole) {
    case 'SUPER_ADMIN':
      return {
        label: 'Super Administrador',
        description:
          'Acceso global a todas las familias, plantillas ejecutivas y resumen financiero.',
        dataScope: 'Todas las familias',
        templateAccess: 'Todas (incl. resumen financiero global)',
        canSaveReports: true,
        canScheduleEmail: true,
        canPinWidgets: true,
      }
    case 'ADMIN':
      return {
        label: 'Administrador',
        description: 'Plantillas y explorador sobre todas las familias de la organización.',
        dataScope: 'Todas las familias',
        templateAccess: 'Todas excepto resumen financiero global',
        canSaveReports: true,
        canScheduleEmail: true,
        canPinWidgets: true,
      }
    case 'MANAGER':
      return {
        label: 'Gestor de inventario',
        description: 'Reportes operativos limitados a las familias que tienes asignadas.',
        dataScope: 'Familias asignadas',
        templateAccess: 'Plantillas operativas y datasets explorables',
        canSaveReports: true,
        canScheduleEmail: true,
        canPinWidgets: true,
      }
  }
}

export function resolveUserReportRole(
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): InventoryReportRole {
  if (isSuperAdmin) return 'SUPER_ADMIN'
  if (role === 'ADMIN') return 'ADMIN'
  if (canManageInventory) return 'MANAGER'
  return 'MANAGER'
}

export function canAccessTemplate(slug: string, userRole: InventoryReportRole): boolean {
  const template = REPORT_TEMPLATES.find(t => t.slug === slug)
  if (!template) return false
  return template.roles.includes(userRole)
}

export function canAccessDataset(datasetId: string, userRole: InventoryReportRole): boolean {
  const dataset = REPORT_DATASETS.find(d => d.id === datasetId)
  if (!dataset) return false
  return dataset.roles.includes(userRole)
}

export function getTemplateBySlug(slug: string): ReportTemplateDef | undefined {
  return REPORT_TEMPLATES.find(t => t.slug === slug)
}

export function getDatasetById(id: string): ReportDatasetDef | undefined {
  const dataset = REPORT_DATASETS.find(d => d.id === id)
  if (!dataset) return undefined
  return enrichDatasetWithGroupBy(dataset)
}

function enrichDatasetWithGroupBy(dataset: ReportDatasetDef): ReportDatasetDef {
  if (dataset.filters.some(f => f.key === 'groupBy')) return dataset
  const config = DATASET_GROUP_BY[dataset.id]
  if (!config) return dataset
  return {
    ...dataset,
    filters: [
      ...dataset.filters,
      {
        key: 'groupBy',
        label: 'Agrupar por',
        type: 'select',
        defaultValue: ALL_FILTER,
        options: [
          { value: ALL_FILTER, label: 'Sin agrupar (detalle)' },
          ...config.fields.map(f => ({ value: f.key, label: f.label })),
        ],
      },
    ],
  }
}

export function getVisibleTemplates(userRole: InventoryReportRole): ReportTemplateDef[] {
  return REPORT_TEMPLATES.filter(t => t.roles.includes(userRole))
}

export function getVisibleDatasets(userRole: InventoryReportRole): ReportDatasetDef[] {
  return REPORT_DATASETS.filter(d => d.roles.includes(userRole)).map(enrichDatasetWithGroupBy)
}

export function getDefaultFilterValues(filters: ReportFilterDef[]): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const filter of filters) {
    if (filter.defaultValue) {
      defaults[filter.key] = filter.defaultValue
    } else if (filter.type === 'select' && filter.options?.[0]) {
      defaults[filter.key] = filter.options[0].value
    }
  }
  return defaults
}

export function getDefaultVisibleColumns(dataset: ReportDatasetDef): string[] {
  return dataset.columns.filter(c => c.defaultVisible !== false).map(c => c.key)
}
