# 📚 Guía de Usuario: Base de Conocimientos

**Sistema de Tickets Moderno**  
**Versión:** 1.0  
**Fecha:** Febrero 2026

---

## 📖 Índice

1. [Introducción](#introducción)
2. [Para Clientes](#para-clientes)
3. [Para Técnicos](#para-técnicos)
4. [Para Administradores](#para-administradores)
5. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

La Base de Conocimientos es un repositorio de soluciones documentadas que te ayuda a:
- ✅ Encontrar soluciones rápidamente
- ✅ Resolver problemas sin crear tickets
- ✅ Aprender de experiencias previas
- ✅ Compartir conocimiento con el equipo

---

## Para Clientes

### 🔍 Cómo Buscar Soluciones

#### Opción 1: Búsqueda Directa
1. Ve a **Base de Conocimientos** en el menú
2. Usa el buscador en la parte superior
3. Escribe palabras clave de tu problema
4. Revisa los resultados sugeridos
5. Click en el artículo que más se parezca a tu problema

#### Opción 2: Explorar por Categorías
1. Ve a **Base de Conocimientos**
2. Navega por las categorías disponibles:
   - Hardware
   - Software
   - Red y Conectividad
   - Seguridad
3. Click en la categoría relevante
4. Explora los artículos disponibles

#### Opción 3: Sugerencias Automáticas
1. Cuando vayas a **Crear Ticket**
2. Escribe el título de tu problema
3. El sistema te mostrará automáticamente artículos similares
4. Revisa las sugerencias antes de crear el ticket

### 📖 Cómo Leer un Artículo

1. **Título:** Describe el problema o solución
2. **Resumen:** Vista rápida del contenido
3. **Categoría y Tags:** Para encontrar artículos relacionados
4. **Contenido:** Solución paso a paso
5. **Estadísticas:** Vistas y valoraciones de otros usuarios

### 👍 Cómo Votar un Artículo

Si un artículo te ayudó:
1. Scroll hasta el final del artículo
2. Click en **"Útil"** si resolvió tu problema
3. Click en **"No útil"** si no te ayudó

**¿Por qué votar?**
- Ayuda a otros usuarios a encontrar las mejores soluciones
- Ayuda al equipo a mejorar la documentación
- Reconoce el trabajo de los técnicos

### 🎫 Cuándo Crear un Ticket

Crea un ticket si:
- ❌ No encontraste solución en la base de conocimientos
- ❌ La solución no funcionó en tu caso
- ❌ Tu problema es diferente a los documentados
- ❌ Necesitas ayuda personalizada

**Recuerda:** Siempre busca primero en la base de conocimientos. ¡Podrías resolver tu problema en minutos!

### ⭐ Cómo Calificar un Ticket Resuelto

Después de que tu ticket sea resuelto:
1. Abre el ticket resuelto
2. Verás la opción **"Calificar Servicio"**
3. Califica en 5 categorías:
   - Calificación General
   - Tiempo de Respuesta
   - Habilidad Técnica
   - Comunicación
   - Resolución del Problema
4. Agrega comentarios (opcional)
5. Click en **"Enviar Calificación"**

Tu feedback ayuda a mejorar el servicio.

---

## Para Técnicos

### 📝 Cómo Crear un Artículo

#### Método 1: Desde un Ticket Resuelto (Recomendado)
1. Abre el ticket que resolviste
2. Click en **"Resolver Ticket"**
3. Escribe el comentario de resolución
4. Marca el checkbox **"Crear artículo de conocimiento"**
5. Click en **"Resolver y Crear Artículo"**
6. Se abrirá automáticamente el formulario de artículo
7. Completa los campos:
   - **Título:** Descriptivo y claro (ej: "Solución: Error al imprimir")
   - **Resumen:** Breve descripción (opcional)
   - **Contenido:** Solución paso a paso en Markdown
   - **Tags:** Palabras clave (máximo 10)
8. Usa la pestaña **"Vista Previa"** para ver cómo se verá
9. Click en **"Crear Artículo"**

#### Método 2: Crear Artículo Manualmente
1. Ve a **Gestión de Artículos** (solo técnicos/admin)
2. Click en **"Nuevo Artículo"**
3. Completa el formulario
4. Selecciona la categoría apropiada
5. Agrega tags relevantes
6. Click en **"Crear Artículo"**

### ✍️ Consejos para Escribir Buenos Artículos

#### Estructura Recomendada:
```markdown
# Título del Problema

## Descripción
Breve explicación del problema

## Requisitos Previos
- Qué necesitas antes de empezar
- Permisos necesarios
- Herramientas requeridas

## Solución Paso a Paso

### 1. Primer Paso
Descripción detallada...

### 2. Segundo Paso
Descripción detallada...

### 3. Tercer Paso
Descripción detallada...

## Solución de Problemas Comunes
- Problema A: Solución
- Problema B: Solución

## Prevención
Cómo evitar que vuelva a ocurrir

## Contacto
Si el problema persiste, crea un ticket de soporte.
```

#### Mejores Prácticas:
- ✅ Usa lenguaje claro y simple
- ✅ Incluye capturas de pantalla (si es posible)
- ✅ Numera los pasos
- ✅ Usa listas para opciones
- ✅ Incluye comandos exactos
- ✅ Agrega advertencias si es necesario
- ✅ Revisa ortografía y gramática

### 🏷️ Cómo Elegir Tags

**Buenos tags:**
- Específicos: "vpn", "impresora", "outlook"
- Relevantes: Relacionados con el problema
- Comunes: Términos que los usuarios buscarían

**Evita:**
- Tags muy genéricos: "problema", "error"
- Tags muy largos: "error-al-conectar-vpn-en-windows"
- Duplicados: "VPN" y "vpn" (usa minúsculas)

### 📊 Cómo Ver Estadísticas de tus Artículos

1. Ve a **Gestión de Artículos**
2. Verás estadísticas globales:
   - Total de artículos
   - Total de vistas
   - Valoración promedio
3. Filtra por **"Mis Artículos"** (si disponible)
4. Cada artículo muestra:
   - Número de vistas
   - Votos útiles/no útiles
   - Porcentaje de utilidad

### ✏️ Cómo Editar un Artículo

1. Abre el artículo que creaste
2. Click en el icono de **"Editar"** (lápiz)
3. Modifica el contenido necesario
4. Click en **"Guardar Cambios"**

**Nota:** Solo puedes editar tus propios artículos (los admins pueden editar cualquiera).

---

## Para Administradores

### 🎛️ Gestión de Artículos

#### Ver Todos los Artículos
1. Ve a **Gestión de Artículos**
2. Verás lista completa de artículos
3. Usa filtros para encontrar artículos específicos:
   - Por categoría
   - Por autor
   - Por fecha
   - Por popularidad

#### Editar Cualquier Artículo
1. Abre el artículo
2. Click en **"Editar"**
3. Realiza cambios
4. Click en **"Guardar"**

#### Eliminar Artículos
1. Abre el artículo
2. Click en **"Eliminar"**
3. Confirma la acción

**⚠️ Advertencia:** Eliminar un artículo es permanente.

### 📊 Métricas y Estadísticas

#### Dashboard de Conocimientos
- **Total de Artículos:** Cantidad total publicada
- **Total de Vistas:** Vistas acumuladas
- **Valoración Promedio:** % de votos útiles
- **Artículos Más Vistos:** Top 10
- **Artículos Mejor Valorados:** Top 10

#### Métricas de Impacto
- **Tickets Evitados:** Estimado de tickets no creados
- **Tiempo Ahorrado:** Tiempo de soporte ahorrado
- **Tasa de Adopción:** % de usuarios que usan la base
- **Satisfacción:** Promedio de calificaciones

### 🔧 Mantenimiento

#### Revisar Artículos Obsoletos
1. Filtra por **"Más Antiguos"**
2. Revisa artículos de hace más de 6 meses
3. Actualiza o elimina según sea necesario

#### Promover Buenos Artículos
1. Identifica artículos con alta valoración
2. Compártelos en comunicaciones internas
3. Agrégalos a documentación oficial

#### Capacitar al Equipo
1. Revisa artículos de baja calidad
2. Da feedback a los autores
3. Comparte mejores prácticas
4. Reconoce buenos artículos

---

## Preguntas Frecuentes

### ❓ ¿Quién puede ver los artículos?
**R:** Todos los usuarios autenticados (clientes, técnicos y administradores).

### ❓ ¿Quién puede crear artículos?
**R:** Solo técnicos y administradores.

### ❓ ¿Puedo editar artículos de otros?
**R:** Solo si eres administrador. Los técnicos solo pueden editar sus propios artículos.

### ❓ ¿Cómo sé si un artículo es confiable?
**R:** Revisa:
- Número de vistas (artículos populares)
- Porcentaje de votos útiles (>80% es excelente)
- Badge "Muy útil" (indica alta valoración)
- Fecha de creación (más reciente suele ser mejor)

### ❓ ¿Qué hago si un artículo está desactualizado?
**R:** 
- **Clientes:** Vota "No útil" y crea un ticket
- **Técnicos:** Edita el artículo con información actualizada
- **Admins:** Actualiza o elimina el artículo

### ❓ ¿Puedo compartir un artículo?
**R:** Sí, usa el botón de **"Compartir"** en el artículo. Puedes:
- Copiar el enlace
- Compartir en redes (si está habilitado)
- Enviar por email

### ❓ ¿Los artículos son públicos?
**R:** No, solo usuarios autenticados del sistema pueden verlos.

### ❓ ¿Cómo se ordenan los resultados de búsqueda?
**R:** Por relevancia, considerando:
- Coincidencias en título (mayor peso)
- Coincidencias en tags
- Coincidencias en contenido
- Popularidad (vistas y votos)

### ❓ ¿Puedo deshacer un voto?
**R:** Sí, puedes cambiar tu voto en cualquier momento o eliminarlo.

### ❓ ¿Qué es Markdown?
**R:** Es un formato de texto simple que permite dar formato al contenido:
- `# Título` = Título grande
- `## Subtítulo` = Subtítulo
- `**negrita**` = **negrita**
- `*cursiva*` = *cursiva*
- `- item` = Lista con viñetas
- `1. item` = Lista numerada

### ❓ ¿Cuántos tags puedo agregar?
**R:** Máximo 10 tags por artículo.

### ❓ ¿Puedo agregar imágenes a los artículos?
**R:** Actualmente no está implementado, pero puedes usar enlaces a imágenes externas en Markdown.

---

## 📞 Soporte

¿Necesitas ayuda con la Base de Conocimientos?

- **Email:** soporte@miempresa.com
- **Teléfono:** +1234567890
- **Crear Ticket:** Usa el sistema de tickets

---

## 📝 Notas de Versión

**Versión 1.0 - Febrero 2026**
- ✅ Sistema de base de conocimientos completo
- ✅ Búsqueda inteligente
- ✅ Sistema de votación
- ✅ Integración con tickets
- ✅ Sugerencias automáticas
- ✅ Sistema de calificaciones

---

**Última actualización:** 5 de Febrero, 2026
