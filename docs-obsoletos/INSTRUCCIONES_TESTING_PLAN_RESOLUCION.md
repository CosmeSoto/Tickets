# 🧪 Instrucciones de Testing: Plan de Resolución Mejorado

**Fecha:** 2026-02-06  
**Módulo:** Plan de Resolución de Tickets  
**Prioridad:** 🔴 ALTA - Probar antes de producción  

---

## 🚀 Inicio Rápido

```bash
# 1. Ir al directorio del proyecto
cd sistema-tickets-nextjs

# 2. Verificar correcciones aplicadas
./verificar-correcciones-plan-resolucion.sh

# 3. Iniciar servidor de desarrollo
npm run dev

# 4. Abrir navegador
# http://localhost:3000
```

---

## 📋 Checklist de Testing

### ✅ PARTE 1: Error 500 en Comentarios

#### Test 1.1: Crear Comentario como Técnico
1. Login como técnico
2. Ir a cualquier ticket: `/technician/tickets/[id]`
3. Scroll hasta la sección de comentarios
4. Escribir un comentario de prueba
5. Click en "Agregar Comentario"

**Resultado Esperado:**
- ✅ Comentario se crea sin error 500
- ✅ Comentario aparece en la lista
- ✅ Toast de éxito se muestra
- ✅ No hay errores en consola

**Si falla:**
- ❌ Revisar consola del navegador
- ❌ Revisar logs del servidor
- ❌ Verificar que `authorId` esté correcto en DB

---

#### Test 1.2: Crear Comentario Interno
1. Login como técnico
2. Ir a un ticket
3. Marcar checkbox "Comentario interno"
4. Escribir comentario
5. Agregar comentario

**Resultado Esperado:**
- ✅ Comentario se crea con `isInternal: true`
- ✅ Badge "Interno" visible
- ✅ No visible para clientes

---

#### Test 1.3: Auditoría de Comentarios
1. Crear un comentario
2. Verificar en base de datos:
```sql
SELECT * FROM audit_logs 
WHERE entity_type = 'comment' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Resultado Esperado:**
- ✅ Registro de auditoría creado
- ✅ Campo `user_email` tiene valor
- ✅ Campo `details` contiene metadata
- ✅ No hay errores

---

### ✅ PARTE 2: Plan de Resolución Mejorado

#### Test 2.1: Badges con Tooltips
1. Login como técnico
2. Ir a ticket con plan de resolución
3. Hover sobre badge de estado (ej: "En Progreso")
4. Hover sobre badge de prioridad (ej: "Alta")

**Resultado Esperado:**
- ✅ Tooltip aparece con descripción
- ✅ Texto claro y legible
- ✅ Iconos visibles en badges
- ✅ Colores correctos según estado

**Estados a verificar:**
- ⏳ Pendiente - gris
- ▶️ En Progreso - azul
- ✅ Completada - verde
- 🚫 Bloqueada - rojo

---

#### Test 2.2: Menú Dropdown de Acciones
1. Click en botón ⋮ (tres puntos) de una tarea
2. Verificar opciones del menú

**Resultado Esperado:**
- ✅ Menú se abre correctamente
- ✅ Opción "Cambiar Estado" con submenú
- ✅ 4 estados disponibles en submenú
- ✅ Opción "Eliminar Tarea" visible
- ✅ Iconos junto a cada opción

---

#### Test 2.3: Cambiar Estado a "Bloqueada"
1. Abrir menú de acciones de una tarea
2. Click en "Cambiar Estado"
3. Click en "🚫 Bloqueada"

**Resultado Esperado:**
- ✅ Estado cambia a "Bloqueada"
- ✅ Badge se actualiza con color rojo
- ✅ Icono 🚫 visible
- ✅ Toast: "Tarea marcada como bloqueada"
- ✅ Tarea se recarga con nuevo estado

---

#### Test 2.4: Cambiar Estado a "En Progreso"
1. Cambiar tarea a "En Progreso"

**Resultado Esperado:**
- ✅ Estado cambia a "En Progreso"
- ✅ Badge azul con icono ▶️
- ✅ Toast: "Tarea iniciada. El tiempo se está registrando."

---

#### Test 2.5: Completar Tarea
1. Click en checkbox de una tarea pendiente

**Resultado Esperado:**
- ✅ Tarea se marca como completada
- ✅ Título con tachado (line-through)
- ✅ Badge verde con ✅
- ✅ Toast: "¡Tarea completada exitosamente!"
- ✅ Progreso del plan se actualiza

---

#### Test 2.6: Eliminar Tarea
1. Abrir menú de acciones
2. Click en "🗑️ Eliminar Tarea"
3. Verificar diálogo de confirmación

**Resultado Esperado:**
- ✅ Diálogo aparece con título "¿Eliminar tarea?"
- ✅ Descripción clara del impacto
- ✅ Botones "Cancelar" y "Eliminar"
- ✅ Botón "Eliminar" en rojo

**Test 2.6.1: Cancelar Eliminación**
1. Click en "Cancelar"

**Resultado Esperado:**
- ✅ Diálogo se cierra
- ✅ Tarea NO se elimina
- ✅ Sin cambios en el plan

**Test 2.6.2: Confirmar Eliminación**
1. Click en "Eliminar"

**Resultado Esperado:**
- ✅ Tarea se elimina
- ✅ Desaparece de la lista
- ✅ Toast: "Tarea eliminada del plan de resolución"
- ✅ Contador de tareas se actualiza

---

#### Test 2.7: Información Contextual
1. Verificar que cada tarea muestre:

**Resultado Esperado:**
- ✅ 📅 Fecha de creación
- ✅ 🎯 Fecha de vencimiento (si existe)
- ✅ ✅ Fecha de completado (si está completada)
- ✅ 👤 Asignación (si está asignada)
- ✅ 🎯 Horas estimadas (si existe)
- ✅ ⏰ Horas reales (si existe)

---

#### Test 2.8: Agregar Nueva Tarea
1. Click en "Agregar Tarea"
2. Llenar formulario:
   - Título: "Tarea de prueba"
   - Descripción: "Descripción de prueba"
   - Prioridad: Alta
   - Horas estimadas: 2
   - Fecha de vencimiento: [fecha futura]
3. Click en "Agregar Tarea"

**Resultado Esperado:**
- ✅ Tarea se crea correctamente
- ✅ Aparece en la lista
- ✅ Información completa visible
- ✅ Toast de éxito
- ✅ Formulario se limpia

---

#### Test 2.9: Modo Oscuro
1. Cambiar a modo oscuro (si está disponible)
2. Verificar todos los elementos

**Resultado Esperado:**
- ✅ Badges legibles en modo oscuro
- ✅ Tooltips visibles
- ✅ Menú dropdown legible
- ✅ Diálogo de confirmación legible
- ✅ Colores apropiados para modo oscuro

---

#### Test 2.10: Progreso del Plan
1. Verificar tarjeta de resumen del plan

**Resultado Esperado:**
- ✅ Barra de progreso actualizada
- ✅ Porcentaje correcto
- ✅ Contador de tareas correcto
- ✅ Estadísticas actualizadas:
  - Total Tareas
  - Completadas
  - Horas Estimadas
  - Horas Reales

---

### ✅ PARTE 3: Testing de Permisos

#### Test 3.1: Como Técnico (canEdit=true)
1. Login como técnico asignado al ticket

**Resultado Esperado:**
- ✅ Puede cambiar estado de tareas
- ✅ Puede eliminar tareas
- ✅ Puede agregar tareas
- ✅ Menú de acciones visible

---

#### Test 3.2: Como Cliente (canEdit=false)
1. Login como cliente

**Resultado Esperado:**
- ✅ Puede VER el plan
- ❌ NO puede cambiar estados
- ❌ NO puede eliminar tareas
- ❌ NO puede agregar tareas
- ❌ Menú de acciones NO visible

---

#### Test 3.3: Como Admin (canEdit=true)
1. Login como admin

**Resultado Esperado:**
- ✅ Puede hacer TODO
- ✅ Puede cambiar cualquier estado
- ✅ Puede eliminar cualquier tarea
- ✅ Puede agregar tareas

---

### ✅ PARTE 4: Testing de Errores

#### Test 4.1: Sin Conexión a Internet
1. Desconectar internet
2. Intentar cambiar estado de tarea

**Resultado Esperado:**
- ✅ Toast de error aparece
- ✅ Mensaje claro: "No se pudo actualizar la tarea"
- ✅ Estado NO cambia
- ✅ No hay crash

---

#### Test 4.2: Tarea No Existe
1. Intentar eliminar tarea que ya fue eliminada

**Resultado Esperado:**
- ✅ Toast de error
- ✅ Mensaje apropiado
- ✅ Plan se recarga

---

#### Test 4.3: Validación de Formulario
1. Intentar agregar tarea sin título

**Resultado Esperado:**
- ✅ Toast de error
- ✅ Mensaje: "El título de la tarea es requerido"
- ✅ Tarea NO se crea

---

### ✅ PARTE 5: Testing de Performance

#### Test 5.1: Plan con Muchas Tareas
1. Crear plan con 20+ tareas
2. Verificar rendimiento

**Resultado Esperado:**
- ✅ Lista se renderiza rápido
- ✅ Scroll suave
- ✅ Menús se abren sin lag
- ✅ Actualizaciones rápidas

---

#### Test 5.2: Múltiples Cambios Rápidos
1. Cambiar estado de varias tareas rápidamente

**Resultado Esperado:**
- ✅ Todos los cambios se aplican
- ✅ No hay conflictos
- ✅ UI se actualiza correctamente

---

## 🐛 Reporte de Bugs

Si encuentras algún problema, documenta:

```markdown
### Bug: [Título descriptivo]

**Pasos para reproducir:**
1. [Paso 1]
2. [Paso 2]
3. [Paso 3]

**Resultado esperado:**
[Qué debería pasar]

**Resultado actual:**
[Qué está pasando]

**Capturas de pantalla:**
[Si aplica]

**Consola del navegador:**
[Errores en consola]

**Logs del servidor:**
[Errores del servidor]

**Entorno:**
- Navegador: [Chrome/Firefox/Safari]
- Versión: [Versión del navegador]
- Sistema: [macOS/Windows/Linux]
- Rol: [Admin/Técnico/Cliente]
```

---

## ✅ Checklist Final

Antes de marcar como completado, verificar:

- [ ] Error 500 en comentarios resuelto
- [ ] Tooltips funcionan en todos los badges
- [ ] Menú dropdown se abre correctamente
- [ ] Estado "Bloqueada" disponible y funcional
- [ ] Confirmación de eliminación funciona
- [ ] Información contextual visible
- [ ] Permisos funcionan correctamente
- [ ] Modo oscuro se ve bien
- [ ] No hay errores en consola
- [ ] No hay errores TypeScript
- [ ] Performance es buena
- [ ] Todos los toast aparecen correctamente

---

## 📊 Reporte de Testing

Al finalizar, completar:

```markdown
## Reporte de Testing - Plan de Resolución

**Fecha:** [Fecha]
**Tester:** [Nombre]
**Duración:** [Tiempo]

### Resumen
- Tests ejecutados: [X/35]
- Tests pasados: [X]
- Tests fallidos: [X]
- Bugs encontrados: [X]

### Tests Pasados
- ✅ [Lista de tests que pasaron]

### Tests Fallidos
- ❌ [Lista de tests que fallaron]

### Bugs Encontrados
1. [Bug 1]
2. [Bug 2]

### Recomendaciones
- [Recomendación 1]
- [Recomendación 2]

### Conclusión
[Listo para producción / Necesita correcciones]
```

---

## 🎯 Criterios de Aceptación

Para considerar el testing completo:

1. ✅ **Funcionalidad:** Todas las funciones trabajan como se espera
2. ✅ **UX:** Interfaz clara y profesional
3. ✅ **Performance:** Respuesta rápida sin lag
4. ✅ **Errores:** Manejo apropiado de errores
5. ✅ **Permisos:** Roles funcionan correctamente
6. ✅ **Accesibilidad:** Tooltips y descripciones claras
7. ✅ **Responsive:** Funciona en diferentes tamaños de pantalla
8. ✅ **Modo Oscuro:** Se ve bien en ambos modos

---

**Preparado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Versión:** 1.0  
**Estado:** 📋 Listo para Testing
