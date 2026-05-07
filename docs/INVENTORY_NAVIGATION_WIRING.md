# Navegación y Wiring - Módulo Inventario

**Fecha:** 7 de Mayo, 2026  
**Spec:** inventory-quantity-management  
**Estado:** ✅ Completado

---

## 📍 Rutas Implementadas

### Páginas Públicas

| Ruta                                        | Componente            | Estado | Descripción                           |
| ------------------------------------------- | --------------------- | ------ | ------------------------------------- |
| `/inventory/equipment/public/for-sale`      | `PublicForSalePage`   | ✅     | Vitrina pública con equipos agrupados |
| `/inventory/equipment/public/[equipmentId]` | `EquipmentPublicPage` | ✅     | Detalle público de equipo             |
| `/inventory/equipment/[id]/verify`          | `EquipmentVerifyPage` | ✅     | Verificación de equipo con QR         |

### Páginas Privadas (Autenticadas)

| Ruta                            | Componente             | Estado | Descripción                  |
| ------------------------------- | ---------------------- | ------ | ---------------------------- |
| `/inventory/equipment/grouped`  | `GroupedInventoryPage` | ✅     | Vista agrupada de inventario |
| `/inventory/equipment/bulk/new` | `BulkEquipmentNewPage` | ✅     | Creación masiva de equipos   |
| `/inventory`                    | `InventoryPage`        | ✅     | Listado general de equipos   |

---

## 🔗 Navegación en Sidebar

### Estructura Actual

```typescript
// src/components/layout/role-dashboard-layout.tsx

{
  name: 'Inventario',
  href: '/inventory',
  icon: Package,
  children: [
    { name: 'Activos', href: '/inventory', icon: Monitor },
    { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
    { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
    { name: 'Actas', href: '/inventory/acts', icon: FileText },
    { name: 'Proveedores', href: '/inventory/suppliers', icon: Building2 },
    { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
    { name: 'Catálogos', href: '/inventory/catalogs', icon: Database },
    { name: 'Configuración', href: '/admin/settings/inventory', icon: Settings },
  ],
}
```

### Enlaces Adicionales Recomendados

**Opción 1: Agregar al menú Activos**

```typescript
{ name: 'Activos', href: '/inventory', icon: Monitor },
{ name: 'Vista Agrupada', href: '/inventory/equipment/grouped', icon: Layers },
{ name: 'Crear Lote', href: '/inventory/equipment/bulk/new', icon: PackagePlus },
```

**Opción 2: Submenú dentro de Activos**

```typescript
{
  name: 'Activos',
  href: '/inventory',
  icon: Monitor,
  children: [
    { name: 'Todos los Activos', href: '/inventory', icon: Monitor },
    { name: 'Vista Agrupada', href: '/inventory/equipment/grouped', icon: Layers },
    { name: 'Crear Lote', href: '/inventory/equipment/bulk/new', icon: PackagePlus },
  ],
}
```

**Decisión:** Las páginas son accesibles directamente por URL. Los usuarios pueden:

- Acceder a vista agrupada desde botón en listado principal
- Acceder a creación masiva desde botón "Crear lote" en vista agrupada
- Navegación contextual (no requiere enlaces en sidebar)

---

## 🔄 Flujo de Datos y Caché

### Invalidación de Caché

```typescript
// Patrón implementado en todos los endpoints de escritura

// 1. Crear equipo individual
POST /api/inventory/equipment
→ Invalida: cache.invalidate('inventory:equipment:*')

// 2. Crear lote de equipos
POST /api/inventory/equipment/bulk
→ Invalida: cache.invalidate('inventory:equipment:*')

// 3. Aprobar solicitud con equipos
PATCH /api/inventory/asset-requests/[id]/approve
→ Invalida: cache.invalidate('asset-requests')
→ Invalida: cache.invalidate('inventory:equipment:*')

// 4. Actualizar equipo
PUT /api/inventory/equipment/[id]
→ Invalida: cache.invalidate('inventory:equipment:*')
```

### Actualización de UI

**Componentes con SWR/React Query:**

- `GroupedInventoryPage` - Revalida automáticamente cada 30s
- `PublicForSalePage` - Revalida automáticamente cada 30s
- `AssetRequestDetailSheet` - Revalida después de cada acción

**Patrón de actualización:**

```typescript
// 1. Mutación optimista (opcional)
mutate('/api/endpoint', optimisticData, false)

// 2. Petición al servidor
await fetch('/api/endpoint', { method: 'POST', body })

// 3. Revalidación
mutate('/api/endpoint')
```

---

## 🎯 Componentes y sus Dependencias

### PublicForSalePage

**Dependencias:**

- `GroupedEquipmentCard` - Tarjeta de grupo
- `UnitsListSheet` - Sheet con lista de unidades
- `generateGroupContactMessage()` - Mensajes WhatsApp
- `generateUnitContactMessage()` - Mensajes WhatsApp

**Endpoints:**

- GET `/api/public/assets-for-sale` - Obtener equipos agrupados

**Flujo:**

```
Usuario → Ver equipos en venta
  ↓
Cargar grupos desde API (caché 30s)
  ↓
Mostrar tarjetas agrupadas
  ↓
Click "Ver unidades" → Abrir UnitsListSheet
  ↓
Click "Contactar" → Generar mensaje WhatsApp
```

---

### GroupedInventoryPage

**Dependencias:**

- `GroupedInventoryTable` - Tabla con agrupación
- `EquipmentFilters` - Filtros de búsqueda
- `ExportButtons` - Exportar CSV/Excel/PDF

**Endpoints:**

- GET `/api/inventory/equipment/grouped` - Obtener equipos agrupados con contadores

**Flujo:**

```
Usuario → Ver inventario agrupado
  ↓
Aplicar filtros (familia, tipo, búsqueda)
  ↓
Cargar grupos desde API (caché 30s)
  ↓
Mostrar tabla con contadores por estado
  ↓
Expandir fila → Ver unidades individuales
  ↓
Click "Crear lote" → Navegar a BulkEquipmentNewPage con datos prellenados
```

---

### BulkEquipmentNewPage

**Dependencias:**

- `BulkEquipmentForm` - Formulario de creación masiva
- `StockIndicatorBadge` - Indicador de stock
- `bulkEquipmentInputSchema` - Validación Zod

**Endpoints:**

- POST `/api/inventory/equipment/bulk` - Crear lote de equipos
- GET `/api/inventory/equipment/stock` - Consultar stock (badge)

**Flujo:**

```
Usuario → Crear lote de equipos
  ↓
Ingresar cantidad (1-100)
  ↓
Seleccionar modo de códigos (auto/manual)
  ↓
Ingresar datos comunes (marca, modelo, tipo)
  ↓
Ver indicador de stock en tiempo real
  ↓
Submit → Crear N equipos en transacción atómica
  ↓
Mostrar resumen de creación
  ↓
Navegar a inventario o crear otro lote
```

---

### AssetRequestCreateForm

**Dependencias:**

- `createAssetRequestSchema` - Validación Zod
- `useDebounce` - Debounce para búsqueda de activos

**Endpoints:**

- POST `/api/inventory/asset-requests` - Crear solicitud
- GET `/api/inventory/equipment/stock/available` - Validar stock disponible
- GET `/api/inventory/assets` - Buscar activos del catálogo

**Flujo:**

```
Usuario → Crear solicitud de activo
  ↓
Seleccionar tipo de activo (EQUIPMENT, etc.)
  ↓
Ingresar cantidad (1-100)
  ↓
Seleccionar activo del catálogo (opcional)
  ↓
Validar stock disponible en tiempo real
  ↓
Submit → Crear solicitud
  ↓
Notificar a Family Admins y Super Admin
```

---

### AssetRequestDetailSheet + ApproveRejectDialog + EquipmentSelectorDialog

**Dependencias:**

- `ApproveRejectDialog` - Diálogo de aprobación/rechazo
- `EquipmentSelectorDialog` - Selector de equipos
- `validateReviewerComment` - Validación de comentario

**Endpoints:**

- GET `/api/inventory/asset-requests/[id]` - Obtener detalle
- PATCH `/api/inventory/asset-requests/[id]` - Cambiar estado
- PATCH `/api/inventory/asset-requests/[id]/approve` - Aprobar con equipos
- GET `/api/inventory/equipment` - Listar equipos disponibles

**Flujo (Aprobación con quantity > 1):**

```
Super Admin → Aprobar solicitud
  ↓
Abrir ApproveRejectDialog
  ↓
Ingresar comentario (min 10 caracteres)
  ↓
Click "Continuar"
  ↓
Abrir EquipmentSelectorDialog
  ↓
Cargar equipos disponibles del tipo solicitado
  ↓
Seleccionar exactamente N equipos (validación estricta)
  ↓
Click "Aprobar y Asignar"
  ↓
Enviar equipmentIds al endpoint de aprobación
  ↓
Crear N asignaciones en transacción atómica
  ↓
Actualizar estado de equipos a ASSIGNED
  ↓
Notificar al solicitante con códigos de equipos
```

---

## ✅ Verificación de Integración

### Checklist de Wiring

- [x] **Rutas públicas accesibles sin autenticación**
  - `/inventory/equipment/public/for-sale` ✅
  - `/inventory/equipment/public/[equipmentId]` ✅

- [x] **Rutas privadas requieren autenticación**
  - `/inventory/equipment/grouped` ✅
  - `/inventory/equipment/bulk/new` ✅

- [x] **Navegación contextual funcional**
  - Botón "Crear lote" en vista agrupada → BulkEquipmentNewPage ✅
  - Botón "Ver unidades" en tarjeta → UnitsListSheet ✅
  - Botón "Contactar" → Mensaje WhatsApp ✅

- [x] **Invalidación de caché después de mutaciones**
  - Crear equipo → Invalida listados ✅
  - Crear lote → Invalida listados y agrupados ✅
  - Aprobar solicitud → Invalida solicitudes y equipos ✅

- [x] **Actualización en tiempo real**
  - Stock indicator actualiza al cambiar marca/modelo/tipo ✅
  - Disponibilidad actualiza al seleccionar tipo en solicitud ✅
  - Contadores actualizan después de acciones ✅

- [x] **Manejo de errores**
  - Validación de formularios con mensajes claros ✅
  - Errores de API mostrados con toast ✅
  - Estados de carga con spinners ✅

- [x] **Permisos y autorización**
  - Verificación de `inventoryEnabled` en todos los endpoints ✅
  - Verificación de rol en operaciones sensibles ✅
  - Acceso a familias según asignación ✅

---

## 🎨 Estados de UI

### Loading States

**Implementados:**

- Spinner en carga inicial de datos
- Skeleton loaders en tablas (opcional - mejora futura)
- Botones con estado "loading" durante submit
- Indicadores de progreso en operaciones largas

**Ejemplo:**

```typescript
{loading ? (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
) : (
  <DataTable data={data} />
)}
```

### Error States

**Implementados:**

- Alert con mensaje de error en componentes
- Toast notifications para errores de API
- Validación inline en formularios
- Mensajes específicos por tipo de error

**Ejemplo:**

```typescript
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### Empty States

**Implementados:**

- Mensaje cuando no hay datos
- Sugerencias de acción (crear primer registro)
- Iconos ilustrativos

**Ejemplo:**

```typescript
{data.length === 0 && (
  <div className="text-center py-12">
    <Package className="h-12 w-12 mx-auto text-muted-foreground" />
    <p className="mt-4 text-muted-foreground">
      No hay equipos disponibles
    </p>
    <Button onClick={onCreate} className="mt-4">
      Crear primer equipo
    </Button>
  </div>
)}
```

---

## 🚀 Mejoras Futuras (Opcional)

### Error Boundaries

**Ubicación recomendada:**

- Layout principal de inventario
- Páginas individuales críticas

**Implementación:**

```typescript
// src/components/inventory/InventoryErrorBoundary.tsx
export class InventoryErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```

### Skeleton Loaders

**Componentes que se beneficiarían:**

- `GroupedInventoryTable` - Skeleton de tabla
- `PublicForSalePage` - Skeleton de tarjetas
- `AssetRequestDetailSheet` - Skeleton de detalle

**Implementación:**

```typescript
// src/components/ui/skeleton-table.tsx
export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
```

---

## 📊 Resumen de Estado

| Aspecto            | Estado | Notas                                      |
| ------------------ | ------ | ------------------------------------------ |
| Rutas configuradas | ✅     | Todas las rutas funcionan correctamente    |
| Navegación sidebar | ✅     | Enlaces contextuales implementados         |
| Invalidación caché | ✅     | Patrón consistente en todas las mutaciones |
| Actualización UI   | ✅     | SWR con revalidación automática            |
| Loading states     | ✅     | Spinners y estados de carga                |
| Error handling     | ✅     | Alerts y toasts implementados              |
| Empty states       | ✅     | Mensajes y sugerencias de acción           |
| Permisos           | ✅     | Verificación en endpoints y UI             |
| Error boundaries   | ⚠️     | Opcional - mejora futura                   |
| Skeleton loaders   | ⚠️     | Opcional - mejora futura                   |

**Conclusión:** ✅ **Wiring y navegación completamente funcionales**

El sistema está listo para uso en producción. Las mejoras opcionales (error boundaries, skeleton loaders) pueden implementarse en iteraciones futuras según necesidad.
