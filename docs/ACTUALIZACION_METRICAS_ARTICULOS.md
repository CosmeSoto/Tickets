# Actualización de Métricas en Artículos Existentes

**Fecha:** 10 de Marzo, 2026  
**Estado:** ✅ Solución Disponible

## Problema Identificado

Los artículos de conocimiento creados ANTES del commit `84f99a6` muestran métricas incompletas:

```markdown
### Métricas
- **Tareas completadas:** 0 de 0
- **Tiempo estimado total:** 12 minutos
```

**Causa:** Estos artículos fueron generados con una versión antigua del código que solo incluía métricas del plan de resolución dentro de la sección del plan.

## Código Antiguo vs Nuevo

### ❌ Código Antiguo (Antes del 84f99a6)

```typescript
// Dentro de la sección del plan
if (ticket.resolution_plans && ticket.resolution_plans.length > 0) {
  const plan = ticket.resolution_plans[0]
  // ... código del plan ...
  
  // Métricas del plan (INCOMPLETAS)
  suggestedContent += `### Métricas\n\n`
  suggestedContent += `- **Tareas completadas:** ${plan.completedTasks} de ${plan.totalTasks}\n`
  if (plan.estimatedHours) {
    suggestedContent += `- **Tiempo estimado total:** ${plan.estimatedHours} horas\n`
  }
}
```

**Problema:** Solo mostraba información del plan, no del ticket completo.

### ✅ Código Nuevo (Actual)

```typescript
// Sección independiente con métricas COMPLETAS del ticket
suggestedContent += `## 📊 Métricas de Resolución\n\n`

// Tiempo total de resolución (desde creación hasta resolución)
suggestedContent += `- **Tiempo de resolución:** ${resolutionTime}\n`

// Tiempo de primera respuesta del técnico
suggestedContent += `- **Tiempo de primera respuesta:** ${firstResponseTime}\n`

// Interacciones desglosadas
suggestedContent += `- **Interacciones totales:** ${totalComments} (${clientComments} del cliente, ${techComments} del equipo técnico)\n`

// Información del plan (si existe)
if (ticket.resolution_plans && ticket.resolution_plans.length > 0) {
  const plan = ticket.resolution_plans[0]
  suggestedContent += `- **Tareas del plan:** ${plan.completedTasks} de ${plan.totalTasks} completadas\n`
  if (plan.estimatedHours) {
    suggestedContent += `- **Tiempo estimado del plan:** ${plan.estimatedHours} horas\n`
  }
  if (plan.actualHours && plan.actualHours > 0) {
    suggestedContent += `- **Tiempo real del plan:** ${plan.actualHours} horas\n`
  }
}
```

**Mejora:** Muestra métricas completas del ciclo de vida del ticket.

## Soluciones Disponibles

### Opción 1: Crear Nuevos Artículos (Recomendado)

Los nuevos artículos creados desde tickets resueltos automáticamente tendrán las métricas completas.

**Pasos:**
1. Resolver un ticket (o usar uno ya resuelto)
2. Ir a la página del ticket
3. Hacer clic en "Crear Artículo"
4. El artículo generado tendrá las métricas completas

**Resultado esperado:**
```markdown
## 📊 Métricas de Resolución

- **Tiempo de resolución:** 2 días 5 horas
- **Tiempo de primera respuesta:** 15 minutos
- **Interacciones totales:** 8 (3 del cliente, 5 del equipo técnico)
- **Tareas del plan:** 3 de 3 completadas
- **Tiempo estimado del plan:** 12 horas
- **Tiempo real del plan:** 10.5 horas
```

### Opción 2: Actualizar Artículos Existentes (Script)

Para actualizar los artículos ya creados, ejecutar el script de migración:

```bash
# Instalar tsx si no está instalado
npm install -D tsx

# Ejecutar el script de actualización
npx tsx scripts/update-article-metrics.ts
```

**El script:**
1. Busca todos los artículos con ticket de origen
2. Identifica artículos con métricas antiguas
3. Calcula métricas reales desde el ticket
4. Reemplaza la sección antigua con métricas completas
5. Actualiza el contenido en la base de datos

**Salida esperada:**
```
🔄 Iniciando actualización de métricas en artículos...

📊 Encontrados 15 artículos con ticket de origen

🔧 Actualizando artículo: "Solución: Reseto clave"
  ✓ Métricas actualizadas
    - Tiempo de resolución: 2 horas
    - Primera respuesta: 15 minutos
    - Interacciones: 5

✓ Artículo "Solución: Error de conexión" ya tiene métricas actualizadas

📈 Resumen:
  ✓ Artículos actualizados: 10
  - Artículos omitidos: 5
  📊 Total procesados: 15

✅ Actualización completada!
```

## Métricas Incluidas en Artículos Nuevos

### 1. Tiempo de Resolución
Tiempo total desde que se creó el ticket hasta que se marcó como resuelto.

**Cálculo:**
```typescript
const resolutionTimeMs = resolvedAt.getTime() - createdAt.getTime()
```

**Formato:**
- Menos de 1 hora: "45 minutos"
- Menos de 24 horas: "5.5 horas"
- Más de 24 horas: "2 días 5 horas"

### 2. Tiempo de Primera Respuesta
Tiempo desde la creación del ticket hasta el primer comentario de un técnico o administrador.

**Cálculo:**
```typescript
const firstTechComment = ticket.comments.find(c => 
  c.users.role === 'TECHNICIAN' || c.users.role === 'ADMIN'
)
const firstResponseMs = firstTechComment.createdAt - ticket.createdAt
```

### 3. Interacciones Totales
Número total de comentarios desglosados por rol.

**Cálculo:**
```typescript
const clientComments = ticket.comments.filter(c => c.users.role === 'CLIENT').length
const techComments = ticket.comments.filter(c => 
  c.users.role === 'TECHNICIAN' || c.users.role === 'ADMIN'
).length
```

**Formato:** "8 (3 del cliente, 5 del equipo técnico)"

### 4. Información del Plan (si existe)
- Tareas completadas vs totales
- Tiempo estimado del plan
- Tiempo real del plan (si se registró)

## Verificación

### Antes de la Actualización
```markdown
## 📝 Plan de Resolución

**Título:** Reseteo en el sistema

### Métricas
- **Tareas completadas:** 0 de 0
- **Tiempo estimado total:** 12 minutos

## 💡 Conclusión
...
```

### Después de la Actualización
```markdown
## 📝 Plan de Resolución

**Título:** Reseteo en el sistema

### Tareas Realizadas
1. **Verificar usuario**
   - Estado: Completada
   ...

## 📊 Métricas de Resolución

- **Tiempo de resolución:** 2 horas
- **Tiempo de primera respuesta:** 15 minutos
- **Interacciones totales:** 5 (2 del cliente, 3 del equipo técnico)
- **Tareas del plan:** 1 de 1 completadas
- **Tiempo estimado del plan:** 12 minutos
- **Tiempo real del plan:** 10 minutos

## 💡 Conclusión
...
```

## Archivos Relacionados

- **Endpoint de creación:** `src/app/api/tickets/[id]/create-article/route.ts`
- **Script de actualización:** `scripts/update-article-metrics.ts`
- **Commit de mejora:** `84f99a6 - feat: Mejorar métricas en artículos de base de conocimiento`

## Notas Importantes

1. **Los artículos NO se actualizan automáticamente** - El contenido se genera una vez al crear el artículo
2. **Toda la información es real** - No hay datos hardcodeados, todo viene de la base de datos
3. **El script es seguro** - Solo actualiza artículos con métricas antiguas, no afecta artículos ya actualizados
4. **Backup recomendado** - Hacer backup de la base de datos antes de ejecutar el script

## Conclusión

✅ Código actual genera métricas completas  
✅ Script disponible para actualizar artículos existentes  
✅ Toda la información es real y dinámica  
✅ Sistema listo para producción  

---

**Desarrollado por:** Kiro AI Assistant  
**Archivos creados:** 2 (script + documentación)  
**Estado:** ✅ Listo para usar
