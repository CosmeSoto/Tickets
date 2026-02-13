# 🧪 Guía de Testing: Feedback en Módulo de Tickets

**Fecha:** 2026-02-06  
**Módulo:** Tickets (Técnico y Admin)  
**Objetivo:** Verificar que todos los tooltips funcionan correctamente  

---

## 📋 Checklist de Testing Manual

### 1. Página de Técnico - Detalle de Ticket
**URL:** `/technician/tickets/[id]`

#### A. Header - Botones de Artículo
- [ ] **Botón "Crear Artículo"** (solo si ticket está RESOLVED y no tiene artículo)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Crea un artículo de conocimiento con la solución de este ticket"
  - Verificar que aparece rápidamente
  - Verificar que desaparece al quitar el mouse

- [ ] **Botón "Ver Artículo"** (solo si ticket está RESOLVED y tiene artículo)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Ver el artículo de conocimiento creado desde este ticket"
  - Verificar badge "Borrador" si aplica

#### B. Tab "Estado" - Actualizar Estado
- [ ] **Selector de Estado**
  - Pasar mouse sobre el selector
  - Verificar tooltip: "Selecciona el nuevo estado del ticket según su progreso"
  - Verificar que no interfiere con abrir el selector

- [ ] **Botón "Actualizar Estado"**
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Guarda el nuevo estado del ticket"
  - Verificar que el botón está deshabilitado si no hay cambios

#### C. Tabs de Navegación
- [ ] **Tab "Estado"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Actualiza el estado del ticket"

- [ ] **Tab "Historial"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Cronología completa de actividades y cambios"

- [ ] **Tab "Plan de Resolución"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Gestiona las tareas para resolver este ticket"

- [ ] **Tab "Archivos"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Archivos adjuntos del ticket"

#### D. Tab "Archivos" - Botones de Descarga
- [ ] **Botón "Descargar"** (para cada archivo)
  - Pasar mouse sobre cada botón de descarga
  - Verificar tooltip: "Descarga el archivo [nombre del archivo]"
  - Verificar que muestra el nombre correcto del archivo

---

### 2. Página de Admin - Detalle de Ticket
**URL:** `/admin/tickets/[id]`

#### A. Header Actions
- [ ] **Botón "Volver"**
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Volver a la lista de todos los tickets"

- [ ] **Botón "Crear Artículo"** (solo si ticket está RESOLVED y no tiene artículo)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Crea un artículo de conocimiento con la solución de este ticket"

- [ ] **Botón "Ver Artículo"** (solo si ticket está RESOLVED y tiene artículo)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Ver el artículo de conocimiento creado desde este ticket"

- [ ] **Botón "Editar"** (cuando NO está editando)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Editar información del ticket"

- [ ] **Botón "Cancelar"** (cuando SÍ está editando)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Cancelar edición y descartar cambios"

- [ ] **Botón "Guardar"** (cuando está editando)
  - Pasar mouse sobre el botón
  - Verificar tooltip: "Guarda los cambios realizados al ticket"

#### B. Tabs de Navegación
- [ ] **Tab "Historial"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Cronología completa de actividades y cambios"

- [ ] **Tab "Plan de Resolución"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Gestiona las tareas para resolver este ticket"

- [ ] **Tab "Calificación"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Calificación del cliente y estadísticas del técnico"

- [ ] **Tab "Archivos"**
  - Pasar mouse sobre el tab
  - Verificar tooltip: "Archivos adjuntos del ticket"

#### C. Tab "Archivos" - Botones de Descarga
- [ ] **Botón "Descargar"** (para cada archivo)
  - Pasar mouse sobre cada botón de descarga
  - Verificar tooltip: "Descarga el archivo [nombre del archivo]"
  - Verificar que muestra el nombre correcto del archivo

---

## 🎨 Testing de Modos de Visualización

### Modo Claro
- [ ] Todos los tooltips son legibles en modo claro
- [ ] Contraste adecuado entre texto y fondo
- [ ] Tooltips no se mezclan con el fondo

### Modo Oscuro
- [ ] Todos los tooltips son legibles en modo oscuro
- [ ] Contraste adecuado entre texto y fondo
- [ ] Tooltips no se mezclan con el fondo

---

## 📱 Testing Responsive

### Desktop (> 1024px)
- [ ] Todos los tooltips aparecen correctamente
- [ ] Texto completo visible en botones
- [ ] Tooltips no se cortan en los bordes

### Tablet (768px - 1024px)
- [ ] Tooltips se adaptan al espacio disponible
- [ ] Texto de botones puede estar abreviado pero tooltips muestran info completa
- [ ] Tooltips no interfieren con la navegación

### Mobile (< 768px)
- [ ] Tooltips funcionan en dispositivos táctiles
- [ ] Tooltips no bloquean elementos importantes
- [ ] Texto abreviado en botones pero tooltips completos

---

## ⚡ Testing de Performance

### Tiempo de Aparición
- [ ] Tooltips aparecen en < 500ms al pasar el mouse
- [ ] No hay lag o retraso notable
- [ ] Transición suave

### Tiempo de Desaparición
- [ ] Tooltips desaparecen inmediatamente al quitar el mouse
- [ ] No quedan "colgados" en pantalla
- [ ] No interfieren con otros elementos

---

## 🐛 Testing de Edge Cases

### Tickets sin Artículo
- [ ] Botón "Crear Artículo" solo aparece si ticket está RESOLVED
- [ ] Tooltip correcto en botón "Crear Artículo"

### Tickets con Artículo
- [ ] Botón "Ver Artículo" aparece correctamente
- [ ] Badge "Borrador" visible si artículo no está publicado
- [ ] Tooltip correcto en botón "Ver Artículo"

### Tickets sin Archivos
- [ ] Tab "Archivos" muestra mensaje apropiado
- [ ] No hay botones de descarga sin archivos

### Tickets con Múltiples Archivos
- [ ] Cada botón de descarga tiene tooltip con nombre correcto
- [ ] Tooltips no se superponen entre archivos

---

## ✅ Criterios de Aceptación

### Funcionalidad
- ✅ Todos los tooltips aparecen al pasar el mouse
- ✅ Todos los tooltips desaparecen al quitar el mouse
- ✅ Tooltips no interfieren con la funcionalidad de los botones
- ✅ Tooltips muestran información útil y clara

### Consistencia
- ✅ Mismo patrón de tooltips en toda la página
- ✅ Mismo estilo visual que Plan de Resolución
- ✅ Descripciones claras y concisas

### Accesibilidad
- ✅ Tooltips legibles en modo claro y oscuro
- ✅ Contraste adecuado
- ✅ Funcionan en dispositivos táctiles

---

## 🚀 Comandos de Testing

### Iniciar el Sistema
```bash
cd sistema-tickets-nextjs
npm run dev
```

### Acceder a las Páginas
1. **Técnico:** http://localhost:3000/technician/tickets/[id]
2. **Admin:** http://localhost:3000/admin/tickets/[id]

### Cambiar entre Modos
- Usar el toggle de tema en la interfaz
- Verificar tooltips en ambos modos

---

## 📊 Reporte de Bugs

Si encuentras algún problema, documenta:

1. **Elemento afectado:** ¿Qué botón/tooltip?
2. **Comportamiento esperado:** ¿Qué debería pasar?
3. **Comportamiento actual:** ¿Qué está pasando?
4. **Pasos para reproducir:** ¿Cómo llegar al bug?
5. **Navegador/Dispositivo:** ¿Dónde ocurre?
6. **Screenshot:** Captura de pantalla si es posible

---

## 📝 Notas Adicionales

### Tooltips Condicionales
- Algunos tooltips solo aparecen en ciertas condiciones (ej: ticket RESOLVED)
- Verificar que las condiciones se cumplen antes de reportar como bug

### Interacción con Otros Componentes
- Verificar que tooltips no interfieren con:
  - Dropdowns
  - Modales
  - Otros tooltips
  - Navegación

### Testing en Diferentes Navegadores
- Chrome/Edge (Chromium)
- Firefox
- Safari (si es posible)

---

**Preparado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Estado:** 📋 GUÍA DE TESTING  
**Uso:** Testing manual de mejoras de feedback

