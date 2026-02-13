# 🏢 SISTEMA DE DEPARTAMENTOS MEJORADO

## 🎯 Situación Actual

### Schema de Prisma
```prisma
model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  department String?  // ← Campo de texto libre, sin validación
  // ...
}
```

### Problemas Identificados
1. ❌ **Sin tabla de departamentos**: No hay modelo Department en Prisma
2. ❌ **Campo de texto libre**: Permite cualquier valor sin validación
3. ❌ **Inconsistencias posibles**: "IT" vs "it" vs "I.T." vs "Tecnología"
4. ❌ **Sin gestión centralizada**: No hay forma de administrar departamentos

## 🔧 Soluciones Propuestas

### Opción 1: Crear Tabla de Departamentos (Profesional)
**Ventajas**:
- ✅ Normalización de BD
- ✅ Relaciones FK
- ✅ Validación a nivel de BD
- ✅ Integridad referencial

**Desventajas**:
- ❌ Requiere migración de Prisma
- ❌ Cambios en múltiples archivos
- ❌ Migración de datos existentes
- ❌ Más tiempo de implementación

### Opción 2: Usar SystemSettings (Práctico) ⭐ RECOMENDADO
**Ventajas**:
- ✅ Sin cambios en schema
- ✅ Sin migración necesaria
- ✅ Implementación rápida
- ✅ Flexible y escalable
- ✅ Mantiene compatibilidad

**Desventajas**:
- ⚠️ Sin validación a nivel de BD
- ⚠️ Validación en capa de aplicación

## 🚀 Implementación Recomendada (Opción 2)

### 1. Usar SystemSettings para Departamentos Predefinidos

```typescript
// Almacenar en system_settings
{
  key: 'departments',
  value: JSON.stringify([
    'Tecnología',
    'Soporte Técnico',
    'Redes',
    'Hardware',
    'Software',
    'Seguridad',
    'Infraestructura'
  ]),
  description: 'Lista de departamentos predefinidos'
}
```

### 2. API para Gestionar Departamentos

```typescript
// GET /api/admin/departments
// Retorna: departamentos predefinidos + departamentos en uso

// POST /api/admin/departments
// Agrega nuevo departamento a la lista

// DELETE /api/admin/departments/:name
// Elimina departamento (solo si no está en uso)
```

### 3. Componente de Selector Mejorado

```typescript
<DepartmentSelector
  value={department}
  onChange={setDepartment}
  allowCustom={true}  // Permite agregar nuevos
  showInUse={true}    // Muestra cuántos usuarios lo usan
/>
```

### 4. Lógica de Departamentos

```typescript
const getDepartments = async () => {
  // 1. Obtener departamentos predefinidos de SystemSettings
  const predefined = await getSystemSetting('departments')
  
  // 2. Obtener departamentos en uso de Users
  const inUse = await prisma.user.groupBy({
    by: ['department'],
    where: { department: { not: null } },
    _count: true
  })
  
  // 3. Combinar y deduplicar
  const all = [...new Set([...predefined, ...inUse.map(d => d.department)])]
  
  return all.sort()
}
```

## 📊 Flujo de Usuario

### Crear/Editar Técnico
1. Usuario abre formulario
2. Ve selector de departamento con:
   - Departamentos predefinidos
   - Departamentos en uso (con contador)
   - Opción "Agregar nuevo"
3. Selecciona o crea departamento
4. Sistema valida y guarda

### Filtrar por Departamento
1. Usuario ve filtro de departamentos
2. Solo muestra departamentos que tienen técnicos
3. Muestra contador de técnicos por departamento
4. Filtra en tiempo real

## 🎨 UI Mejorada

### Selector de Departamento
```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar departamento" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Departamentos Predefinidos</SelectLabel>
      {predefined.map(dept => (
        <SelectItem key={dept} value={dept}>
          {dept}
        </SelectItem>
      ))}
    </SelectGroup>
    
    {inUse.length > 0 && (
      <SelectGroup>
        <SelectLabel>En Uso</SelectLabel>
        {inUse.map(dept => (
          <SelectItem key={dept.name} value={dept.name}>
            {dept.name} ({dept.count} técnicos)
          </SelectItem>
        ))}
      </SelectGroup>
    )}
    
    <SelectSeparator />
    <SelectItem value="__custom__">
      <Plus className="h-4 w-4 mr-2" />
      Agregar nuevo departamento
    </SelectItem>
  </SelectContent>
</Select>
```

## ✅ Beneficios de la Solución

### Para el Usuario
- ✅ Selector intuitivo con sugerencias
- ✅ Ve departamentos existentes
- ✅ Puede crear nuevos fácilmente
- ✅ Evita duplicados

### Para el Sistema
- ✅ Sin cambios en BD
- ✅ Sin migración necesaria
- ✅ Mantiene flexibilidad
- ✅ Fácil de implementar

### Para el Administrador
- ✅ Gestión centralizada
- ✅ Control de departamentos
- ✅ Estadísticas de uso
- ✅ Limpieza de duplicados

## 🔄 Migración de Datos Existentes

### Script de Normalización
```typescript
// Normalizar departamentos existentes
const normalizeDepartment = (dept: string) => {
  const map: Record<string, string> = {
    'it': 'Tecnología',
    'IT': 'Tecnología',
    'I.T.': 'Tecnología',
    'soporte': 'Soporte Técnico',
    'Soporte': 'Soporte Técnico',
    // ...
  }
  return map[dept] || dept
}

// Aplicar normalización
await prisma.user.updateMany({
  where: { department: 'IT' },
  data: { department: 'Tecnología' }
})
```

## 📝 Implementación Paso a Paso

### Paso 1: Crear API de Departamentos
- [ ] GET /api/admin/departments
- [ ] POST /api/admin/departments
- [ ] DELETE /api/admin/departments/:name

### Paso 2: Crear Componente DepartmentSelector
- [ ] Selector con grupos
- [ ] Opción de agregar nuevo
- [ ] Validación de duplicados
- [ ] Contador de uso

### Paso 3: Integrar en Formulario de Técnicos
- [ ] Reemplazar Input por DepartmentSelector
- [ ] Agregar validación
- [ ] Mostrar sugerencias

### Paso 4: Actualizar Filtros
- [ ] Usar departamentos reales
- [ ] Mostrar contador
- [ ] Ordenar por uso

### Paso 5: Normalizar Datos Existentes
- [ ] Script de normalización
- [ ] Migración de datos
- [ ] Verificación

## 🎯 Estado Actual vs Propuesto

| Aspecto | Actual | Propuesto |
|---------|--------|-----------|
| **Tipo de Campo** | String libre | String con sugerencias |
| **Validación** | Ninguna | En aplicación |
| **Gestión** | Manual | Centralizada |
| **Duplicados** | Posibles | Prevenidos |
| **UI** | Input texto | Selector inteligente |
| **Estadísticas** | No | Sí (contador de uso) |

---

**Recomendación**: Implementar Opción 2 (SystemSettings)
**Tiempo Estimado**: 2-3 horas
**Prioridad**: 🟡 MEDIA
**Impacto**: 🟢 ALTO (mejora UX y consistencia)
