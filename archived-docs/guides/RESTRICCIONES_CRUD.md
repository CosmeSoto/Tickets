# Restricciones CRUD - Sistema de Tickets

## Resumen de Restricciones Implementadas

### 🏷️ **CATEGORÍAS**

#### Restricciones de Eliminación:
- ❌ **No se puede eliminar** si tiene tickets asociados (`_count.tickets > 0`)
- ❌ **No se puede eliminar** si tiene subcategorías (`_count.children > 0`)
- ✅ **Se puede eliminar** solo si no tiene tickets ni subcategorías

#### Validaciones:
- Campo `canDelete` calculado automáticamente en la API
- Botón de eliminar deshabilitado cuando `canDelete = false`
- Dialog de confirmación muestra información detallada:
  - Nivel de la categoría
  - Número de tickets asociados
  - Número de subcategorías
  - Número de técnicos asignados

#### Implementación:
```typescript
canDelete: category._count.tickets === 0 && category._count.children === 0
```

---

### 👨‍💻 **TÉCNICOS**

#### Restricciones de Eliminación:
- ❌ **No se puede eliminar** si tiene tickets asignados (`assignedTickets > 0`)
- ❌ **No se puede eliminar** si tiene asignaciones de categorías activas (`technicianAssignments > 0`)
- ✅ **Se puede eliminar** solo si no tiene tickets ni asignaciones activas

#### Validaciones:
- Campo `canDelete` calculado en el frontend basado en contadores
- Verificación adicional en el backend antes de eliminar
- Limpieza automática de asignaciones al eliminar técnico

#### Implementación Frontend:
```typescript
canDelete: (tech._count?.assignedTickets || 0) === 0 && 
          (tech._count?.technicianAssignments || 0) === 0
```

#### Implementación Backend:
```typescript
// Verificar tickets asignados
const assignedTickets = await prisma.ticket.count({
  where: { assigneeId: id }
})

// Verificar asignaciones activas para técnicos
if (user?.role === 'TECHNICIAN') {
  const activeAssignments = await prisma.technicianAssignment.count({
    where: { userId: id, isActive: true }
  })
}
```

---

### 👥 **USUARIOS**

#### Restricciones de Eliminación:
- ❌ **No se puede eliminar** su propia cuenta (admin)
- ❌ **No se puede eliminar** si tiene tickets asignados (`assignedTickets > 0`)
- ❌ **Técnicos**: Restricciones adicionales por asignaciones de categorías
- ✅ **Se puede eliminar** si cumple todas las condiciones

#### Validaciones:
- Campo `canDelete` calculado considerando:
  - No es el usuario actual
  - No tiene tickets asignados
- Verificación en backend para técnicos con asignaciones

#### Implementación:
```typescript
canDelete: user.id !== session?.user?.id && 
          (user._count?.assignedTickets || 0) === 0
```

---

## 🔧 **Funcionalidades Implementadas**

### ✅ **Sistema de Asignación Bidireccional**
- **Técnicos → Categorías**: Asignar categorías a técnicos con prioridades
- **Categorías → Técnicos**: Ver técnicos asignados a cada categoría
- **Sincronización**: Cambios reflejados en ambos módulos

### ✅ **Validaciones de Integridad**
- Verificación de tickets asignados antes de eliminar
- Verificación de relaciones padre-hijo en categorías
- Limpieza automática de asignaciones huérfanas

### ✅ **Interfaz de Usuario Mejorada**
- Botones deshabilitados cuando no se puede eliminar
- Tooltips explicativos con razones de restricción
- Dialogs de confirmación con información detallada
- Indicadores visuales de estado (badges, colores)

### ✅ **Manejo de Errores**
- Mensajes de error específicos por tipo de restricción
- Validación tanto en frontend como backend
- Respuestas consistentes de API con formato estándar

---

## 🧪 **Pruebas**

### Script de Verificación
Ejecutar: `node test-crud-restrictions.js`

**Verifica:**
- Cálculo correcto de `canDelete` en categorías
- Información de técnicos y asignaciones
- Distribución de usuarios por roles
- Estructura de respuestas de API

### Casos de Prueba Manuales
1. **Categorías con tickets**: Intentar eliminar → Debe fallar
2. **Categorías con subcategorías**: Intentar eliminar → Debe fallar
3. **Técnicos con tickets**: Intentar eliminar → Debe fallar
4. **Técnicos con asignaciones**: Intentar eliminar → Debe fallar
5. **Usuario propio**: Intentar eliminar → Debe fallar
6. **Elementos sin restricciones**: Eliminar → Debe funcionar

---

## 📋 **Próximos Pasos**

### Mejoras Sugeridas:
1. **Reasignación Automática**: Opción de reasignar tickets antes de eliminar
2. **Eliminación en Cascada**: Opción controlada para eliminar con dependencias
3. **Auditoría**: Log de intentos de eliminación fallidos
4. **Notificaciones**: Alertas cuando se intenta eliminar elementos con restricciones

### Monitoreo:
- Revisar logs de errores de eliminación
- Verificar integridad de datos periódicamente
- Monitorear rendimiento de consultas de validación

---

## 🔍 **Archivos Modificados**

### Backend:
- `src/lib/services/user-service.ts` - Restricciones de eliminación
- `src/app/api/users/route.ts` - Schemas con asignaciones
- `src/app/api/users/[id]/route.ts` - Validación y respuestas

### Frontend:
- `src/app/admin/technicians/page.tsx` - CRUD completo con restricciones
- `src/app/admin/users/page.tsx` - CRUD mejorado con validaciones
- `src/app/admin/categories/page.tsx` - Dialog mejorado con información

### Pruebas:
- `test-crud-restrictions.js` - Script de verificación
- `RESTRICCIONES_CRUD.md` - Esta documentación