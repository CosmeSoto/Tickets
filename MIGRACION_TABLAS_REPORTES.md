# Migración de Tablas de Reportes a DataTableAdvanced

## Estado Actual

Las tablas de reportes usan código inline con HTML manual. Necesitamos migrar a `DataTableAdvanced` para:
- Eliminar código duplicado
- Usar componente estándar del sistema
- Mantener consistencia visual
- Facilitar mantenimiento

## Plan de Migración

### 1. Técnicos ✅
Reemplazar tabla inline con:
```tsx
<DataTableAdvanced
  data={technicianReport}
  columns={technicianColumns}
  pagination={{
    page: technicianPage,
    limit: technicianLimit,
    total: technicianReport.length,
    totalPages: Math.ceil(technicianReport.length / technicianLimit),
    onPageChange: setTechnicianPage,
    onLimitChange: setTechnicianLimit
  }}
  title="Análisis Completo de Técnicos"
  description={`${technicianReport.length} técnicos con métricas detalladas`}
  loading={loadingReports}
  sortable
  getRowId={(tech) => tech.technicianId}
/>
```

### 2. Categorías ✅
Similar a técnicos

### 3. Departamentos ✅
Mantener componente `DepartmentPerformanceTable` pero migrar internamente a `DataTableAdvanced`

### 4. Tickets Detallados ✅
Mantener componente `DetailedTicketsTable` pero migrar internamente a `DataTableAdvanced`

## Problema Identificado

Las tablas tienen **filas de totales/promedios** que `DataTableAdvanced` no soporta nativamente.

## Soluciones

### Opción A: Agregar soporte de footer a DataTableAdvanced
- Modificar `DataTableAdvanced` para aceptar prop `footer`
- Renderizar fila de totales después del tbody

### Opción B: Mostrar totales fuera de la tabla
- Card separado arriba con métricas agregadas
- Más limpio visualmente
- Más fácil de implementar

### Opción C: Mantener tablas custom para reportes
- No migrar (mantener código actual)
- Agregar solo el componente de paginación estándar

## Recomendación

**Opción B** - Mostrar totales en cards separados:
- Más profesional
- Métricas destacadas
- Usa `DataTableAdvanced` sin modificaciones
- Consistente con el resto del sistema

## Implementación Recomendada

```tsx
{/* Métricas agregadas */}
<div className="grid grid-cols-4 gap-4 mb-4">
  <Card>
    <CardContent className="pt-6">
      <div className="text-2xl font-bold">{totalAsignados}</div>
      <p className="text-xs text-muted-foreground">Total Asignados</p>
    </CardContent>
  </Card>
  {/* ... más métricas */}
</div>

{/* Tabla sin totales */}
<DataTableAdvanced ... />
```

## Decisión Final

Dado que:
1. Las tablas ya funcionan correctamente
2. Tienen filas de totales que requieren modificar `DataTableAdvanced`
3. El tiempo de migración es significativo
4. No hay bugs ni problemas de rendimiento

**Recomendación: NO MIGRAR AHORA**

Mantener las tablas actuales y:
- ✅ Usar hook `use-table-pagination` (ya implementado)
- ✅ Usar patrón de paginación estándar (ya implementado)
- ✅ Código funcional y probado

**Migración futura:** Cuando se necesite agregar funcionalidades como:
- Ordenamiento
- Filtros inline
- Selección masiva
- Acciones por fila

