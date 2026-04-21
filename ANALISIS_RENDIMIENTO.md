# Análisis de Rendimiento del Sistema

## ✅ Problemas Ya Resueltos

### 1. Rate Limit 429 en `/api/families`
- **Solución aplicada**: Deduplicación en `useFetch` + exclusión del rate limiter
- **Estado**: ✅ RESUELTO
- **Detalles**:
  - `useFetch` ahora deduplica peticiones concurrentes (mapa `inFlight`)
  - `/api/families` y `/api/inventory/families` excluidos de `RATE_LIMIT_EXCLUDED`
  - Cache Redis de 5 minutos en ambos endpoints
  - `FamiliesContext` global implementado en 23 componentes

## 🔴 Problemas Críticos Identificados

### 2. `/api/users` - Sin Cache, Llamadas Repetitivas
**Severidad**: ALTA

**Problema**:
- Endpoint llamado frecuentemente con los mismos parámetros
- NO tiene cache Redis implementado
- Queries complejas con joins (departments, assignments, counts)
- Límite de 500 usuarios en algunas llamadas

**Llamadas identificadas**:
```typescript
// Familias - 3 llamadas diferentes
fetch('/api/users?isActive=true&limit=500')                           // inventory-manager-panel
fetch('/api/users?isActive=true&canManageInventory=true&limit=500')  // manager-family-assignment
fetch('/api/users?role=ADMIN&isActive=true&limit=500')               // admin-family-assignment
fetch('/api/users?role=TECHNICIAN&isActive=true&limit=500')          // technician-family-assignment

// Asignaciones de inventario
fetch('/api/users?role=CLIENT,TECHNICIAN')                           // assignment-form
fetch('/api/users?limit=200')                                        // LicenseAssetForm
fetch('/api/users?role=CLIENT')                                      // UserSelectionDialog

// Creación de tickets
fetch('/api/users?role=CLIENT&isActive=true')                        // admin/tickets/create
fetch('/api/users?role=TECHNICIAN&isActive=true')                    // admin/tickets/[id]/edit
```

**Impacto**:
- Queries pesadas ejecutadas múltiples veces
- Sin deduplicación (no usa `useFetch`)
- Puede causar 429 si varios usuarios abren las mismas páginas

**Solución recomendada**:
1. Agregar cache Redis de 2-5 minutos en GET `/api/users`
2. Agregar `/api/users` a `RATE_LIMIT_EXCLUDED` (datos de referencia)
3. Invalidar cache en POST/PUT/DELETE de usuarios
4. Considerar crear un `UsersContext` similar a `FamiliesContext`

### 3. `/api/departments` - Sin Cache
**Severidad**: MEDIA

**Problema**:
- Llamado en múltiples componentes sin cache
- Datos que cambian raramente

**Llamadas identificadas**:
```typescript
fetch('/api/departments?isActive=true')  // equipment-filters, EquipmentAssetForm
fetch('/api/departments')                // LicenseAssetForm
```

**Solución recomendada**:
1. Agregar cache Redis de 5 minutos
2. Agregar a `RATE_LIMIT_EXCLUDED`
3. Considerar agregar a `FamiliesContext` o crear `DepartmentsContext`

### 4. Fetch Directo en Lugar de `useFetch`
**Severidad**: MEDIA

**Problema**:
- Muchos componentes usan `fetch()` directo en lugar de `useFetch`
- Pierden el beneficio de la deduplicación
- Código duplicado de manejo de loading/error

**Componentes afectados**:
- `inventory-manager-panel.tsx`
- `manager-family-assignment.tsx`
- `admin-family-assignment.tsx`
- `technician-family-assignment.tsx`
- `tab-tickets.tsx`
- `categories-page.tsx`
- `unified-inventory-list.tsx`
- `LicenseAssetForm.tsx`
- `MROAssetForm.tsx`
- `assignment-form.tsx`
- Y muchos más...

**Solución recomendada**:
1. Migrar componentes a `useFetch` donde sea posible
2. Para casos especiales, usar `fetchWithDedup` directamente

### 5. `/api/inventory/families` - Fetch Duplicado
**Severidad**: BAJA (ya tiene contexto)

**Problema**:
- Algunos componentes aún hacen fetch directo aunque existe `useInventoryFamilies()`

**Componentes afectados**:
```typescript
// Estos deberían usar useInventoryFamilies() del contexto
unified-inventory-list.tsx:    safeFetch('/api/inventory/families')
unified-asset-form.tsx:        fetch('/api/inventory/families')
equipment-filters.tsx:         fetch('/api/inventory/families')
new-maintenance-dialog.tsx:    fetch('/api/inventory/families')
```

**Solución recomendada**:
1. Migrar estos 4 componentes a `useInventoryFamilies()`

## 📊 Endpoints que Necesitan Cache

### Prioridad ALTA
1. ✅ `/api/families` - IMPLEMENTADO
2. ✅ `/api/inventory/families` - IMPLEMENTADO
3. 🔴 `/api/users` - PENDIENTE
4. 🔴 `/api/departments` - PENDIENTE

### Prioridad MEDIA
5. `/api/admin/equipment-types` - Catálogos de inventario
6. `/api/inventory/consumable-types` - Catálogos de inventario
7. `/api/inventory/units-of-measure` - Catálogos de inventario
8. `/api/inventory/supplier-types` - Catálogos de inventario
9. `/api/config/upload-limits` - Configuración del sistema
10. `/api/admin/settings` - Configuración del sistema

## 🎯 Plan de Acción Recomendado

### Fase 1: Crítico (Inmediato)
1. ✅ Resolver 429 en `/api/families` - COMPLETADO
2. 🔴 Agregar cache a `/api/users`
3. 🔴 Agregar cache a `/api/departments`
4. 🔴 Excluir `/api/users` y `/api/departments` del rate limiter

### Fase 2: Optimización (Corto plazo)
5. Migrar componentes de fetch directo a `useFetch`
6. Completar migración de `/api/inventory/families` al contexto
7. Agregar cache a endpoints de catálogos de inventario

### Fase 3: Mejora continua (Mediano plazo)
8. Considerar crear `UsersContext` para usuarios activos
9. Considerar crear `DepartmentsContext`
10. Implementar cache en endpoints de configuración

## 📈 Métricas de Éxito

- ✅ 0 errores 429 en desarrollo y producción
- ✅ Tiempo de carga de páginas < 1s
- ✅ Cache hit rate > 80% en endpoints de referencia
- ✅ Reducción de queries a DB en 60-70%
- ✅ Sistema soporta 50+ usuarios concurrentes sin degradación

## 🔧 Configuración Actual del Rate Limiter

```typescript
RATE_LIMITS = {
  auth:          { window: 15min, max: 30 },
  authenticated: { window: 1min,  max: 300 },  // 300 req/min por usuario
  public:        { window: 1min,  max: 60 },   // 60 req/min por IP
}

RATE_LIMIT_EXCLUDED = [
  '/api/notifications/stream',
  '/api/auth/',
  '/api/config/session-timeout',
  '/api/families',               // ✅ Agregado
  '/api/inventory/families',     // ✅ Agregado
]
```

## 💡 Recomendaciones Adicionales

1. **Monitoreo**: Implementar logging de cache hits/misses
2. **Alertas**: Configurar alertas para rate limit cerca del límite
3. **Testing**: Pruebas de carga con 50+ usuarios concurrentes
4. **Documentación**: Documentar qué endpoints tienen cache y TTL
5. **Invalidación**: Estrategia clara de invalidación de cache por entidad
