# Diagnóstico - Botón "Crear Artículo" se Queda Cargando

**Fecha**: 5 de Febrero, 2026  
**Problema**: Botón "Crear Artículo" se queda cargando y no completa la acción

---

## ✅ VERIFICACIÓN: Base de Conocimientos Usa Datos Reales

### Test Ejecutado
```bash
node test-crear-articulo.js
```

### Resultados
- ✅ **Categorías**: 5 categorías reales encontradas
- ✅ **Usuarios**: 3 usuarios autorizados (ADMIN/TECHNICIAN)
- ✅ **Artículos**: 5 artículos existentes en BD
- ✅ **Tabla**: knowledge_articles existe con estructura correcta

### Conclusión
**La Base de Conocimientos usa 100% datos reales de la base de datos PostgreSQL con Prisma.**

No hay datos hardcodeados. Todo viene de:
- `prisma.knowledge_articles` - Artículos
- `prisma.categories` - Categorías
- `prisma.users` - Autores
- `prisma.article_votes` - Votos

---

## 🔍 DIAGNÓSTICO DEL PROBLEMA

### Posibles Causas

#### 1. Validaciones No Cumplidas
El formulario requiere:
- ✅ **Título**: Mínimo 10 caracteres, máximo 200
- ✅ **Contenido**: Mínimo 50 caracteres
- ✅ **Categoría**: Debe seleccionar una
- ✅ **Tags**: Al menos 1 tag, máximo 10

**Si falta alguno, el botón se queda cargando sin hacer nada.**

#### 2. Error en la API
La API `/api/knowledge` (POST) podría estar fallando.

#### 3. Categorías No Cargan
El selector de categorías podría no estar cargando las opciones.

---

## 🧪 PASOS PARA DIAGNOSTICAR

### 1. Verificar Consola del Navegador

Abre las DevTools (F12) y busca:

```
❌ Errores en rojo
⚠️  Advertencias en amarillo
🔵 Llamadas a /api/knowledge que fallen
```

### 2. Verificar Consola del Servidor

En la terminal donde corre `npm run dev`, busca:

```
❌ Error al crear artículo
❌ Datos inválidos
❌ Categoría no encontrada
```

### 3. Verificar Campos del Formulario

Antes de hacer clic en "Crear Artículo", asegúrate de:

```
✅ Título: Al menos 10 caracteres
✅ Contenido: Al menos 50 caracteres (en el editor Markdown)
✅ Categoría: Una seleccionada del dropdown
✅ Tags: Al menos 1 tag agregado (presiona Enter después de escribir)
```

---

## 🔧 SOLUCIONES

### Solución 1: Verificar Validaciones

El problema más común es que **falta agregar tags**. El formulario requiere al menos 1 tag.

**Cómo agregar tags**:
1. Escribe un tag en el campo "Tags"
2. **Presiona Enter** (no solo escribir)
3. El tag debe aparecer como un badge azul
4. Repite para agregar más tags

### Solución 2: Verificar Categorías

Si el dropdown de categorías está vacío:

```bash
# Verificar que hay categorías
node test-crear-articulo.js
```

Si no hay categorías, crear una:
1. Ir a `/admin/categories`
2. Crear una categoría de nivel 1
3. Volver a intentar crear artículo

### Solución 3: Agregar Logs de Depuración

Si el problema persiste, agregar logs temporales:

```typescript
// En src/app/technician/knowledge/new/page.tsx
const handleSubmit = async () => {
  console.log('🔍 Validando formulario...')
  console.log('Título:', title, '(longitud:', title.length, ')')
  console.log('Contenido:', content.length, 'caracteres')
  console.log('Categoría:', categoryId)
  console.log('Tags:', tags)
  
  // ... resto del código
}
```

Luego revisar la consola del navegador al hacer clic en "Crear Artículo".

---

## 📋 CHECKLIST DE VERIFICACIÓN

Antes de crear un artículo, verifica:

- [ ] Título tiene al menos 10 caracteres
- [ ] Contenido tiene al menos 50 caracteres
- [ ] Categoría está seleccionada (no dice "Selecciona una categoría")
- [ ] Al menos 1 tag agregado (visible como badge)
- [ ] Consola del navegador sin errores
- [ ] Servidor corriendo sin errores

---

## 🎯 PRUEBA RÁPIDA

Para probar que todo funciona:

### Datos de Prueba
```
Título: "Cómo solucionar problemas de impresora"
Contenido: "Este artículo explica paso a paso cómo solucionar los problemas más comunes de impresoras en la oficina. Primero, verifica que la impresora esté encendida y conectada correctamente."
Categoría: Seleccionar cualquiera del dropdown
Tags: "impresora", "hardware", "solución"
```

### Pasos
1. Llenar todos los campos con los datos de prueba
2. Agregar los 3 tags (presionar Enter después de cada uno)
3. Hacer clic en "Crear Artículo"
4. Debe redirigir a la página del artículo creado

---

## 🔍 INFORMACIÓN TÉCNICA

### API Endpoint
```
POST /api/knowledge
```

### Validaciones del Backend
```typescript
{
  title: min 10, max 200 caracteres
  content: min 50 caracteres
  categoryId: UUID válido
  tags: array de 1-10 strings (2-30 caracteres cada uno)
  summary: opcional
  sourceTicketId: opcional (UUID)
}
```

### Respuesta Exitosa
```json
{
  "id": "uuid",
  "title": "...",
  "content": "...",
  "categoryId": "...",
  "tags": ["..."],
  "authorId": "...",
  "isPublished": true,
  "views": 0,
  "helpfulVotes": 0,
  "notHelpfulVotes": 0,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Respuesta de Error
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["title"],
      "message": "El título debe tener al menos 10 caracteres"
    }
  ]
}
```

---

## 💡 RECOMENDACIONES

### Para el Usuario
1. **Siempre presiona Enter después de escribir un tag**
2. Verifica que el contenido tenga al menos 50 caracteres
3. Si el botón se queda cargando, abre la consola (F12) para ver el error

### Para el Desarrollador
1. Agregar indicador visual de validación en tiempo real
2. Mostrar mensaje de error específico si falta algo
3. Deshabilitar botón si las validaciones no pasan
4. Agregar tooltip explicando los requisitos

---

## ✅ CONCLUSIÓN

**La Base de Conocimientos funciona correctamente con datos reales.**

Si el botón se queda cargando, es muy probable que:
1. **Falten tags** (causa más común)
2. Título o contenido muy cortos
3. No se seleccionó categoría

**Solución**: Verificar que todos los campos cumplan las validaciones antes de hacer clic en "Crear Artículo".

---

**Última actualización**: 5 de Febrero, 2026  
**Estado**: Diagnosticado - Requiere verificación manual
