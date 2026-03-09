# Guía de Validación Práctica - Category Selection

## 🎯 Objetivo

Esta guía te ayudará a validar que la nueva implementación funciona correctamente sin problemas, siguiendo un proceso estructurado de pruebas manuales y automatizadas.

---

## 📋 Checklist Rápido

Usa este checklist para validar rápidamente:

- [ ] **Paso 1:** Tests automatizados pasan (5 min)
- [ ] **Paso 2:** Servidor de desarrollo arranca sin errores (2 min)
- [ ] **Paso 3:** Componente se renderiza correctamente (3 min)
- [ ] **Paso 4:** Búsqueda funciona (5 min)
- [ ] **Paso 5:** Sugerencias funcionan (5 min)
- [ ] **Paso 6:** Navegación visual funciona (5 min)
- [ ] **Paso 7:** Categorías frecuentes funcionan (3 min)
- [ ] **Paso 8:** Base de conocimientos funciona (5 min)
- [ ] **Paso 9:** Accesibilidad funciona (10 min)
- [ ] **Paso 10:** Analytics se registran (5 min)

**Tiempo total estimado:** 45-50 minutos

---

## 🧪 Paso 1: Ejecutar Tests Automatizados

### 1.1 Tests Unitarios

```bash
cd sistema-tickets-nextjs
npm test -- src/features/category-selection
```

**Resultado esperado:**
```
Test Suites: 12 passed, 12 total
Tests:       138 passed, 138 total
```

**Si fallan tests:**
- Revisa el mensaje de error específico
- Verifica que las dependencias estén instaladas: `npm install`
- Verifica que la base de datos esté corriendo

---

### 1.2 Tests de Integración

```bash
npm test -- src/features/category-selection/__tests__/integration
```

**Resultado esperado:**
```
✓ Complete category selection flow
✓ Search and select category
✓ Suggestion engine integration
✓ Knowledge base integration
```

---

### 1.3 Verificar Compilación TypeScript

```bash
npm run type-check
# o
npx tsc --noEmit
```

**Resultado esperado:**
```
No errors found
```

**Si hay errores:**
- Revisa los archivos mencionados
- Verifica que los tipos estén correctamente importados

---

## 🚀 Paso 2: Iniciar Servidor de Desarrollo

```bash
npm run dev
```

**Resultado esperado:**
```
✓ Ready in 3.2s
○ Local:   http://localhost:3000
```

**Verificar en la consola:**
- ✅ No hay errores de compilación
- ✅ No hay warnings críticos
- ✅ El servidor arranca en el puerto esperado

**Si hay errores:**
- Verifica que el puerto 3000 no esté ocupado
- Verifica las variables de entorno en `.env`
- Revisa que la base de datos esté accesible

---

## 🎨 Paso 3: Validar Renderizado del Componente

### 3.1 Abrir Formulario de Creación de Ticket

1. Navega a: `http://localhost:3000/tickets/new`
2. Inicia sesión si es necesario
3. Localiza el selector de categorías

**Resultado esperado:**
- ✅ El componente se renderiza sin errores
- ✅ Se muestra el título "Seleccionar Categoría"
- ✅ Se ven las diferentes secciones (búsqueda, sugerencias, etc.)

---

### 3.2 Verificar Consola del Navegador

Abre DevTools (F12) → Console

**Resultado esperado:**
- ✅ No hay errores en rojo
- ✅ Puede haber logs informativos (normal)

**Errores comunes a ignorar:**
- Warnings de React en desarrollo (normal)
- Mensajes de hot-reload (normal)

**Errores que SÍ son problemas:**
- `TypeError: Cannot read property...`
- `Failed to fetch...`
- `Uncaught Error...`

---

## 🔍 Paso 4: Validar Búsqueda Inteligente

### 4.1 Búsqueda Básica

1. Haz clic en el campo de búsqueda
2. Escribe: `"correo"`

**Resultado esperado:**
- ✅ Aparece un dropdown con resultados
- ✅ Los resultados incluyen categorías relacionadas con correo
- ✅ Se muestra el path completo de cada categoría
- ✅ Los términos coincidentes están resaltados

**Ejemplo de resultado:**
```
📧 Correo Electrónico
   Técnico > Correo Electrónico > Configuración

📧 Problemas de Correo
   Técnico > Correo Electrónico > Problemas de Envío
```

---

### 4.2 Búsqueda Fuzzy (con errores)

1. Escribe: `"corero"` (con error ortográfico)

**Resultado esperado:**
- ✅ Aún muestra resultados de "correo"
- ✅ La búsqueda fuzzy tolera errores

---

### 4.3 Búsqueda sin Resultados

1. Escribe: `"xyzabc123"`

**Resultado esperado:**
- ✅ Muestra mensaje: "No se encontraron categorías"
- ✅ Sugiere revisar la ortografía o usar términos más generales

---

### 4.4 Selección desde Búsqueda

1. Busca: `"correo"`
2. Haz clic en un resultado

**Resultado esperado:**
- ✅ El dropdown se cierra
- ✅ La categoría se selecciona
- ✅ Aparece el panel de confirmación
- ✅ Se muestra el path completo de la categoría seleccionada

---

## 💡 Paso 5: Validar Sugerencias Contextuales

### 5.1 Sugerencias Basadas en Título

1. En el campo "Título del ticket", escribe: `"No puedo enviar correos"`
2. Espera 500ms (debounce)

**Resultado esperado:**
- ✅ Aparece sección "Categorías Sugeridas"
- ✅ Muestra hasta 5 sugerencias relevantes
- ✅ Las sugerencias están relacionadas con correo/envío
- ✅ Cada sugerencia muestra un indicador de relevancia

**Ejemplo:**
```
💡 Categorías Sugeridas

⭐⭐⭐ Correo Electrónico > Problemas de Envío
⭐⭐   Correo Electrónico > Configuración
⭐     Técnico > Conectividad
```

---

### 5.2 Sugerencias Basadas en Descripción

1. En el campo "Descripción", escribe: `"Cuando intento enviar un correo con archivo adjunto, me da error"`
2. Espera 500ms

**Resultado esperado:**
- ✅ Las sugerencias se actualizan
- ✅ Incluyen categorías relacionadas con archivos adjuntos

---

### 5.3 Selección de Sugerencia

1. Haz clic en una sugerencia

**Resultado esperado:**
- ✅ La categoría se selecciona automáticamente
- ✅ Aparece el panel de confirmación
- ✅ Se registra el evento en analytics

---

## 🌳 Paso 6: Validar Navegación Visual

### 6.1 Vista de Árbol Completo

1. Haz clic en "Ver todas las categorías"

**Resultado esperado:**
- ✅ Se muestra el árbol jerárquico completo
- ✅ Las categorías de nivel 1 tienen iconos distintivos
- ✅ Los colores son consistentes por categoría
- ✅ Se muestran breadcrumbs en la parte superior

---

### 6.2 Expandir/Colapsar Categorías

1. Haz clic en una categoría de nivel 1 (ej: "Técnico")

**Resultado esperado:**
- ✅ Se expande mostrando subcategorías
- ✅ El icono cambia (▶ → ▼)
- ✅ Las subcategorías tienen indentación visual

2. Haz clic nuevamente

**Resultado esperado:**
- ✅ Se colapsa ocultando subcategorías

---

### 6.3 Navegación Profunda

1. Expande: Técnico → Correo Electrónico → Problemas de Envío
2. Selecciona una categoría de nivel 4

**Resultado esperado:**
- ✅ Los breadcrumbs muestran el path completo
- ✅ La selección se registra correctamente
- ✅ Aparece el panel de confirmación

---

### 6.4 Modo Paso a Paso

1. Haz clic en "Navegación Guiada"

**Resultado esperado:**
- ✅ Se muestra solo el nivel 1
- ✅ Aparece indicador: "Paso 1 de 4"
- ✅ Hay botones de navegación

2. Selecciona una categoría de nivel 1

**Resultado esperado:**
- ✅ Avanza automáticamente al nivel 2
- ✅ Indicador cambia a: "Paso 2 de 4"
- ✅ Se muestran solo las subcategorías relevantes

3. Continúa hasta el nivel 4

**Resultado esperado:**
- ✅ Cada paso muestra solo las opciones relevantes
- ✅ Puedes retroceder con el botón "Atrás"
- ✅ Al llegar al nivel 4, se completa la selección

---

## ⭐ Paso 7: Validar Categorías Frecuentes

### 7.1 Usuario con Historial

**Prerequisito:** El usuario debe tener al menos 3 tickets previos

1. Abre el selector de categorías

**Resultado esperado:**
- ✅ Aparece sección "Categorías Frecuentes" en la parte superior
- ✅ Muestra hasta 5 categorías más usadas
- ✅ Cada categoría muestra el número de veces usada

**Ejemplo:**
```
⭐ Categorías Frecuentes

📧 Correo Electrónico > Problemas de Envío (5 veces)
🔧 Técnico > Hardware > Impresoras (3 veces)
💻 Software > Office > Word (2 veces)
```

---

### 7.2 Selección Rápida

1. Haz clic en una categoría frecuente

**Resultado esperado:**
- ✅ Se selecciona inmediatamente
- ✅ Aparece el panel de confirmación
- ✅ Se registra como "selección desde frecuentes" en analytics

---

### 7.3 Usuario Nuevo

**Prerequisito:** Usuario con menos de 3 tickets

**Resultado esperado:**
- ✅ NO se muestra la sección "Categorías Frecuentes"
- ✅ El resto del selector funciona normalmente

---

## 📚 Paso 8: Validar Integración con Base de Conocimientos

### 8.1 Artículos Relacionados

1. Selecciona una categoría (ej: "Correo Electrónico > Problemas de Envío")

**Resultado esperado:**
- ✅ Aparece sección "Artículos Relacionados"
- ✅ Muestra hasta 3 artículos relevantes
- ✅ Cada artículo muestra: título, resumen, votos útiles
- ✅ Los artículos están ordenados por relevancia

**Ejemplo:**
```
📚 Artículos Relacionados

📄 Cómo configurar SMTP en Outlook
   Guía paso a paso para configurar...
   👍 45 personas encontraron esto útil

📄 Solución: Error al enviar archivos grandes
   Si recibes error al enviar archivos...
   👍 32 personas encontraron esto útil
```

---

### 8.2 Ver Artículo Completo

1. Haz clic en un artículo

**Resultado esperado:**
- ✅ Se abre un modal con el artículo completo
- ✅ El formulario de ticket permanece en el fondo (no se pierde)
- ✅ El artículo muestra: título, contenido completo, fecha, autor

---

### 8.3 Marcar Artículo como Útil

1. En el modal del artículo, haz clic en "¿Te ayudó este artículo?"
2. Selecciona "Sí, resolvió mi problema"

**Resultado esperado:**
- ✅ Aparece mensaje de confirmación
- ✅ Se ofrece opción: "Cancelar creación de ticket"
- ✅ El voto se registra en la base de datos

---

### 8.4 Continuar con Ticket

1. Selecciona "No, aún necesito ayuda"

**Resultado esperado:**
- ✅ El modal se cierra
- ✅ Vuelves al formulario de ticket
- ✅ La categoría sigue seleccionada
- ✅ Se ofrece vincular el artículo como referencia

---

### 8.5 Búsqueda en Knowledge Base

1. Haz clic en "Buscar en Base de Conocimientos"
2. Escribe: `"configurar correo"`

**Resultado esperado:**
- ✅ Muestra resultados de búsqueda
- ✅ Los resultados son relevantes
- ✅ Puedes abrir cualquier artículo

---

## ♿ Paso 9: Validar Accesibilidad

### 9.1 Navegación por Teclado

**Sin usar el mouse:**

1. Presiona `Tab` repetidamente

**Resultado esperado:**
- ✅ El foco se mueve de forma lógica
- ✅ Cada elemento enfocado tiene un indicador visual claro
- ✅ El orden es: búsqueda → sugerencias → árbol → confirmación

2. Presiona `Ctrl+K` (o `Cmd+K` en Mac)

**Resultado esperado:**
- ✅ El foco va directamente al campo de búsqueda

3. En el campo de búsqueda, escribe algo y presiona `↓` (flecha abajo)

**Resultado esperado:**
- ✅ El foco se mueve al primer resultado
- ✅ Puedes navegar con `↑` y `↓`
- ✅ Presionar `Enter` selecciona el resultado
- ✅ Presionar `Escape` cierra el dropdown

4. En el árbol de categorías, usa `↑` `↓` `←` `→`

**Resultado esperado:**
- ✅ `↑` `↓` navegan entre categorías
- ✅ `→` expande una categoría
- ✅ `←` colapsa una categoría
- ✅ `Enter` selecciona una categoría

---

### 9.2 Lector de Pantalla

**Con NVDA, JAWS, o VoiceOver:**

1. Activa el lector de pantalla
2. Navega al selector de categorías

**Resultado esperado:**
- ✅ Anuncia: "Selector de categorías, región"
- ✅ Cada elemento tiene una etiqueta descriptiva
- ✅ Los cambios de estado se anuncian (ej: "categoría seleccionada")

3. Navega por los resultados de búsqueda

**Resultado esperado:**
- ✅ Anuncia el número de resultados
- ✅ Lee el nombre y path de cada categoría
- ✅ Indica la posición (ej: "1 de 5")

---

### 9.3 Contraste de Color

1. Abre DevTools → Lighthouse
2. Ejecuta auditoría de accesibilidad

**Resultado esperado:**
- ✅ Puntuación de accesibilidad ≥ 90
- ✅ No hay problemas de contraste
- ✅ Todos los elementos interactivos son accesibles

---

### 9.4 Zoom y Tamaño de Texto

1. Aumenta el zoom del navegador al 200%

**Resultado esperado:**
- ✅ El componente sigue siendo usable
- ✅ No hay texto cortado
- ✅ No hay scroll horizontal

2. Reduce el ancho de la ventana a 320px (móvil pequeño)

**Resultado esperado:**
- ✅ El diseño se adapta correctamente
- ✅ Todos los botones son clickeables (≥44x44px)
- ✅ El texto es legible

---

## 📊 Paso 10: Validar Analytics

### 10.1 Verificar Registro de Eventos

1. Abre DevTools → Network
2. Filtra por: `analytics`
3. Realiza varias acciones:
   - Busca una categoría
   - Selecciona una sugerencia
   - Navega por el árbol
   - Selecciona una categoría

**Resultado esperado:**
- ✅ Se envían requests a `/api/analytics/category-selection`
- ✅ Cada acción genera un evento
- ✅ Los eventos tienen la estructura correcta

---

### 10.2 Verificar Estructura de Eventos

Inspecciona el payload de un evento:

```json
{
  "event_type": "category_selected",
  "client_id": "uuid-del-cliente",
  "category_id": "uuid-de-categoria",
  "metadata": {
    "selection_method": "search",
    "time_to_select": 15000,
    "search_query": "correo",
    "confidence_score": 0.85
  }
}
```

**Resultado esperado:**
- ✅ Todos los campos requeridos están presentes
- ✅ Los UUIDs son válidos
- ✅ El metadata contiene información relevante

---

### 10.3 Verificar en Base de Datos

```sql
SELECT * FROM category_analytics 
ORDER BY created_at DESC 
LIMIT 10;
```

**Resultado esperado:**
- ✅ Los eventos se guardan correctamente
- ✅ Los timestamps son correctos
- ✅ Los datos coinciden con las acciones realizadas

---

## 🔧 Paso 11: Validar Feature Flags

### 11.1 Deshabilitar Feature Principal

1. Edita `src/features/category-selection/config/feature-flags.ts`
2. Cambia `enabled: true` a `enabled: false` en `ENHANCED_SELECTOR`
3. Recarga la página

**Resultado esperado:**
- ✅ Se muestra el selector legacy (simple)
- ✅ No hay errores en consola
- ✅ El selector legacy funciona correctamente

---

### 11.2 Deshabilitar Features Individuales

1. Deshabilita `SMART_SEARCH`
2. Recarga la página

**Resultado esperado:**
- ✅ El campo de búsqueda no aparece
- ✅ El resto del selector funciona

Repite con otras features:
- `SUGGESTIONS` → No aparecen sugerencias
- `FREQUENT_CATEGORIES` → No aparecen categorías frecuentes
- `KNOWLEDGE_BASE` → No aparecen artículos relacionados

---

## 🌐 Paso 12: Validar en Diferentes Navegadores

### 12.1 Chrome/Edge (Chromium)

**Resultado esperado:**
- ✅ Todo funciona perfectamente

---

### 12.2 Firefox

**Resultado esperado:**
- ✅ Todo funciona perfectamente
- ✅ Los estilos se ven correctos

---

### 12.3 Safari

**Resultado esperado:**
- ✅ Todo funciona perfectamente
- ✅ Los eventos táctiles funcionan en iOS

---

### 12.4 Navegadores Antiguos (IE11, etc.)

**Resultado esperado:**
- ✅ Se detecta navegador no soportado
- ✅ Se muestra automáticamente el selector fallback
- ✅ El selector fallback funciona correctamente

---

## 📱 Paso 13: Validar en Dispositivos Móviles

### 13.1 Responsive Design

1. Abre DevTools → Device Toolbar
2. Prueba diferentes tamaños:
   - iPhone SE (375px)
   - iPhone 12 (390px)
   - iPad (768px)
   - iPad Pro (1024px)

**Resultado esperado:**
- ✅ El diseño se adapta correctamente
- ✅ Los botones son fáciles de tocar
- ✅ No hay scroll horizontal
- ✅ El texto es legible

---

### 13.2 Eventos Táctiles

En un dispositivo móvil real o simulador:

1. Toca el campo de búsqueda

**Resultado esperado:**
- ✅ El teclado aparece
- ✅ El campo se enfoca correctamente

2. Toca una categoría en el árbol

**Resultado esperado:**
- ✅ Se expande/selecciona correctamente
- ✅ No hay delay perceptible

3. Desliza (scroll) por la lista de categorías

**Resultado esperado:**
- ✅ El scroll es suave
- ✅ No hay lag

---

## ⚡ Paso 14: Validar Rendimiento

### 14.1 Lighthouse Performance

1. Abre DevTools → Lighthouse
2. Ejecuta auditoría de rendimiento

**Resultado esperado:**
- ✅ Performance score ≥ 90
- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3.5s
- ✅ Largest Contentful Paint < 2.5s

---

### 14.2 Tiempo de Carga Inicial

1. Abre DevTools → Network
2. Deshabilita caché
3. Recarga la página
4. Mide el tiempo hasta que el selector es interactivo

**Resultado esperado:**
- ✅ < 500ms en conexión rápida
- ✅ < 1s en conexión 3G simulada

---

### 14.3 Tiempo de Búsqueda

1. Abre DevTools → Performance
2. Inicia grabación
3. Escribe en el campo de búsqueda
4. Detén grabación

**Resultado esperado:**
- ✅ Resultados aparecen en < 200ms
- ✅ No hay bloqueo del hilo principal

---

### 14.4 Virtualización de Listas

1. Expande una categoría con >50 subcategorías
2. Inspecciona el DOM

**Resultado esperado:**
- ✅ Solo se renderizan ~20-30 elementos visibles
- ✅ Los elementos fuera de vista no están en el DOM
- ✅ El scroll es suave

---

## 🐛 Problemas Comunes y Soluciones

### Problema: Tests fallan con "Cannot find module"

**Solución:**
```bash
npm install
npm run build
```

---

### Problema: "Database connection failed"

**Solución:**
1. Verifica que la base de datos esté corriendo
2. Verifica las credenciales en `.env`
3. Ejecuta las migraciones: `npx prisma migrate dev`

---

### Problema: El componente no se renderiza

**Solución:**
1. Verifica que el feature flag esté habilitado
2. Revisa la consola del navegador para errores
3. Verifica que el usuario tenga permisos

---

### Problema: La búsqueda no devuelve resultados

**Solución:**
1. Verifica que haya categorías en la base de datos
2. Revisa el threshold de Fuse.js en `config/fuse.config.ts`
3. Verifica que las categorías tengan keywords

---

### Problema: Analytics no se registran

**Solución:**
1. Verifica que el endpoint `/api/analytics/category-selection` esté funcionando
2. Revisa los logs del servidor
3. Verifica que la tabla `category_analytics` exista

---

## ✅ Checklist Final de Validación

Antes de considerar la implementación lista para producción:

### Funcionalidad
- [ ] Todos los tests automatizados pasan
- [ ] Búsqueda funciona correctamente
- [ ] Sugerencias son relevantes
- [ ] Navegación visual es intuitiva
- [ ] Categorías frecuentes se muestran correctamente
- [ ] Base de conocimientos se integra bien
- [ ] Analytics se registran correctamente

### Accesibilidad
- [ ] Navegación por teclado funciona
- [ ] Lector de pantalla funciona
- [ ] Contraste de color es adecuado (WCAG AA)
- [ ] Funciona con zoom al 200%
- [ ] Funciona en pantallas pequeñas (320px)

### Rendimiento
- [ ] Carga inicial < 500ms
- [ ] Búsqueda < 200ms
- [ ] Lighthouse score ≥ 90
- [ ] Virtualización funciona para listas largas

### Compatibilidad
- [ ] Funciona en Chrome/Edge
- [ ] Funciona en Firefox
- [ ] Funciona en Safari
- [ ] Fallback funciona en navegadores antiguos
- [ ] Funciona en móviles

### Feature Flags
- [ ] Se puede deshabilitar el selector completo
- [ ] Se pueden deshabilitar features individuales
- [ ] El fallback funciona correctamente

### Integración
- [ ] Se integra con el formulario de tickets
- [ ] No rompe funcionalidad existente
- [ ] La API es compatible con el sistema actual

---

## 📞 Soporte

Si encuentras problemas durante la validación:

1. **Revisa los logs:** DevTools Console y Network tab
2. **Consulta la documentación:**
   - [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
   - [ACCESSIBILITY.md](./ACCESSIBILITY.md)
   - [PERFORMANCE.md](./PERFORMANCE.md)
3. **Revisa el código:** Los componentes están bien documentados con JSDoc
4. **Contacta al equipo:** [información de contacto]

---

## 🎉 Conclusión

Si has completado todos los pasos de esta guía y todos los checks están en verde, la implementación está lista para:

1. **Testing interno** (Fase 1 del deployment plan)
2. **Beta testing** con usuarios reales (Fase 2)
3. **Rollout gradual** a producción (Fases 3-5)

Consulta [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md) para los siguientes pasos.

---

**Última actualización:** 2026-03-06  
**Versión:** 1.0.0
