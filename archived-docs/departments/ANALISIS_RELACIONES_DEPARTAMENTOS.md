# Análisis de Relaciones: Departamentos, Técnicos y Categorías

## 📊 Estructura de Relaciones

### Relaciones Actuales (Existentes)
```
User (role=TECHNICIAN)
  └─ TechnicianAssignment (tabla intermedia)
       └─ Category
            └─ Ticket
```

### Relaciones Nuevas (Agregadas)
```
Department (NUEVO)
  ├─ User (técnicos) - relación 1:N
  └─ Category - relación 1:N (OPCIONAL)

User (Técnico)
  ├─ departmentId → Department
  └─ TechnicianAssignment (sin cambios)
       └─ Category
            └─ departmentId → Department (OPCIONAL)
```

## 🎯 Casos de Uso

### 1. Asignación de Técnicos
**Antes:**
- Técnico "Juan" asignado a categorías: "Hardware", "Software"

**Ahora:**
- Técnico "Juan" pertenece al departamento "Soporte Técnico"
- Técnico "Juan" asignado a categorías: "Hardware", "Software"

### 2. Asignación de Categorías a Departamentos (OPCIONAL)
**Ejemplo 1 - Con departamento:**
- Categoría "Hardware - Impresoras" → Departamento "Soporte Técnico"
- Cuando llega ticket de esta categoría, se prioriza técnicos de "Soporte Técnico"

**Ejemplo 2 - Sin departamento:**
- Categoría "General" → Sin departamento asignado
- Cualquier técnico puede atenderla según sus asignaciones

### 3. Auto-asignación Inteligente
```javascript
// Lógica de auto-asignación mejorada:
1. Buscar técnicos asignados a la categoría del ticket
2. Si la categoría tiene departamento, priorizar técnicos de ese departamento
3. Considerar carga de trabajo (maxTickets)
4. Asignar al técnico con menor carga
```

## 📈 Beneficios del Diseño

### ✅ Flexibilidad
- La relación Category→Department es **OPCIONAL**
- No rompe funcionalidad existente
- Permite migración gradual

### ✅ Reportes Mejorados
- Rendimiento por departamento
- Comparación entre departamentos
- Filtros avanzados en reportes

### ✅ Gestión Organizacional
- Estructura jerárquica clara
- Facilita escalabilidad del equipo
- Mejor distribución de carga

### ✅ Compatibilidad
- Todas las queries existentes siguen funcionando
- Los campos son opcionales (nullable)
- Migración sin pérdida de datos

## 🔧 Cambios en el Schema

### Department (Nuevo Modelo)
```prisma
model Department {
  id          String     @id @default(cuid())
  name        String     @unique
  description String?
  color       String?    @default("#3B82F6")
  isActive    Boolean    @default(true)
  order       Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  users       User[]      // Técnicos del departamento
  categories  Category[]  // Categorías asociadas (OPCIONAL)
}
```

### User (Modificado)
```prisma
model User {
  // ... campos existentes
  departmentId String?     // NUEVO - OPCIONAL
  department   Department? @relation(fields: [departmentId], references: [id])
  // ... resto sin cambios
}
```

### Category (Modificado)
```prisma
model Category {
  // ... campos existentes
  departmentId String?     // NUEVO - OPCIONAL
  department   Department? @relation(fields: [departmentId], references: [id])
  // ... resto sin cambios
}
```

### TechnicianAssignment (Sin Cambios)
```prisma
model TechnicianAssignment {
  id           String   @id @default(cuid())
  technicianId String
  categoryId   String
  priority     Int      @default(1)
  maxTickets   Int?
  autoAssign   Boolean  @default(true)
  isActive     Boolean  @default(true)
  // ... sin cambios
}
```

## 🚀 Plan de Migración

### Fase 1: Crear Tabla Departments ✅
- Crear tabla con 10 departamentos iniciales
- Migrar datos existentes de User.department (string) a departmentId

### Fase 2: Actualizar APIs ⏳
- CRUD completo de departamentos
- Actualizar API de técnicos para incluir relación
- Actualizar API de categorías (opcional)

### Fase 3: Actualizar Frontend ⏳
- Selector de departamentos en formulario de técnicos
- Módulo CRUD de departamentos
- Filtros por departamento en reportes

### Fase 4: Integrar en Reportes ⏳
- Agregar departamentos a filtros
- Métricas por departamento
- Exportación con departamentos

### Fase 5: Optimizaciones Futuras 🔮
- Auto-asignación basada en departamento de categoría
- Balanceo de carga por departamento
- Dashboards por departamento

## ⚠️ Consideraciones Importantes

### 1. Retrocompatibilidad
- Todos los campos nuevos son **OPCIONAL** (nullable)
- No se eliminan campos existentes hasta verificar migración
- Queries existentes siguen funcionando

### 2. Migración de Datos
- Script SQL migra automáticamente datos existentes
- Crea departamentos para valores únicos en User.department
- Asigna departmentId basado en nombre

### 3. Validaciones
- Nombre de departamento único
- No se puede eliminar departamento con usuarios asignados
- Categorías pueden existir sin departamento

## 📝 Queries de Ejemplo

### Obtener técnicos con departamento
```typescript
const technicians = await prisma.user.findMany({
  where: { role: 'TECHNICIAN' },
  include: {
    department: true,
    technicianAssignments: {
      include: { category: true }
    }
  }
})
```

### Obtener categorías con departamento
```typescript
const categories = await prisma.category.findMany({
  include: {
    department: true,
    technicianAssignments: {
      include: {
        technician: {
          include: { department: true }
        }
      }
    }
  }
})
```

### Reportes por departamento
```typescript
const reportByDepartment = await prisma.department.findMany({
  include: {
    users: {
      where: { role: 'TECHNICIAN' },
      include: {
        assignedTickets: {
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        }
      }
    },
    categories: {
      include: {
        tickets: {
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        }
      }
    }
  }
})
```

## ✅ Conclusión

El diseño propuesto es:
- **Profesional**: Sigue mejores prácticas de modelado de datos
- **Flexible**: Permite crecimiento sin romper funcionalidad
- **Escalable**: Facilita expansión del equipo y organización
- **Seguro**: Migración sin pérdida de datos
- **Opcional**: No fuerza uso de departamentos si no se necesita

**Recomendación**: Proceder con la migración. El diseño es sólido y bien pensado.
