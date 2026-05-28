# Revisar Módulo de Noticias y Formularios

> **Workspace:** /Users/cosmesoto/Documents/Tickets/sistema-tickets-nextjs

---

## User

revisa el modulo de noticias sera que adicional a los tipos de ventas podemos adicionar formularios donde se puede adjuntar formularios que comun mente ocupa el personal y necesita descargar para que puedan llenar como vacaiones anticipos permisos etc , tu que opinas sera bueno colocarlo en noticias o seria en otra ubicacion como experto revisa y dame la mejor opcion responde y trabaja en español y no implementeas hasta que confirme

## Assistant

Voy a explorar el código del proyecto para entender la estructura del módulo de noticias y darte una recomendación informada.

Vamos a explorar los componentes y la estructura del módulo de noticias para entender cómo funciona actualmente:

Ahora vamos a revisar el módulo de base de conocimiento para comparar:

Vamos a buscar la parte del schema relacionada con las noticias:

Perfecto, ya revisé la estructura completa del sistema. Aquí te doy mi recomendación como experto:

## 📋 Análisis y Recomendación

### ¿Por qué **NO** poner formularios en el módulo de Noticias?

El módulo de noticias está diseñado para **comunicación transitoria** (noticias, anuncios, eventos) con características como:

- Fechas de vigencia (startDate/endDate)
- Reacciones y comentarios
- Feed principal en el dashboard con filtros por período (hoy, semana, mes)

Los formularios (vacaciones, anticipos, permisos) son **recursos permanentes** que los usuarios necesitan acceder repetidamente, no son noticias transitorias.

---

## 🎯 Mejor Opción: **Módulo de "Formularios" o "Recursos Humanos" separado**

Recomiendo crear un **módulo independiente** por estas razones:

### Ventajas clave:

1. **Organización clara**: Los usuarios saben exactamente dónde buscar formularios
2. **Categorización específica**: Puedes organizar formularios por tipo:
   - 📅 Solicitudes de vacaciones
   - 💰 Anticipos y préstamos
   - 📋 Permisos (personal, médicos, etc.)
   - 📝 Evaluaciones y formatos diversos
3. **Funcionalidades dedicadas**:
   - Búsqueda por nombre o categoría
   - Versionado de formularios
   - Estadísticas de descargas
   - Acceso rápido desde la navegación principal
4. **No contamina el feed de noticias**: Los formularios no se mezclan con noticias y eventos

---

## 🤔 Otra opción válida: **Integrar en la Base de Conocimiento**

Si prefieres no crear un módulo nuevo, podrías usar la **Base de Conocimiento** existente:

- Crear una categoría "Formularios y Recursos"
- Organizar subcategorías por tipo de formulario
- Los artículos pueden contener la descripción y el archivo adjunto descargable

---

## 📊 Mi Recomendación Final

**Opción 1 (Recomendada):** Crear un **módulo de Formularios independiente**

- Ruta: `/admin/forms` o `/admin/human-resources`
- Navegación principal separada
- Gestión completa de categorías y formularios

**Opción 2 (Económica):** Usar la **Base de Conocimiento**

- Menos desarrollo
- Aprovecha la infraestructura existente
- Pero menos organizado para este propósito específico

---

¿Qué opción te convence más? ¡Confirmas y ya implementamos! 🚀

## User

pero y si los formularios no solo suelen subir recursos humanos quiza pueda subir salud ocupacional mantenimiento etc como se podria hacer para activar esta seccion a la familia y al usuario segun su rol o familia y quienes pueden subir y en el caso que el formulario sea para toda la organizacion o solo para familias independientes o departamentos

## Assistant

¡Excelente punto! Eso cambia la perspectiva. Vamos a analizar cómo el sistema ya maneja estos patrones en otros módulos para replicar la misma arquitectura.

Primero, revisemos cómo están estructurados otros módulos con control de acceso similar:

¡Perfecto! Ahora veo la arquitectura completa del sistema. Vamos a estructurar esto de manera profesional, replicando los patrones que ya funcionan en tu sistema.

## 📋 Arquitectura Completa para Módulo de Formularios

### 1. **Estructura de Base de Datos (replicando patrones existentes)**

**Tabla principal `forms`** (como `news` y `knowledge_articles`):

- `id`, `title`, `description`, `version`
- `categoryId` (categoría: RH, Salud Ocupacional, Mantenimiento, etc.)
- `familyId` (familia/organización)
- `fileUrl` (archivo PDF/Word descargable)
- `downloadCount` (estadísticas)
- `isActive`
- `createdById`, `createdAt`, `updatedAt`

**Tablas de visibilidad** (exactamente como `news`):

- `form_roles` (visibilidad por rol: ADMIN, TECHNICIAN, etc.)
- `form_users` (visibilidad por usuarios específicos)
- `form_departments` (visibilidad por departamentos)
- `form_families` (visibilidad por familias)

**Tabla `form_categories`**:

- Para organizar formularios por área:
  - 🧑‍💼 Recursos Humanos
  - 🏥 Salud Ocupacional
  - 🔧 Mantenimiento
  - 📦 Logística
  - Etc.

---

### 2. **Control de Acceso y Activación**

**Nivel de Sistema**:

- Agregar entrada en `system_modules` con key `'forms'`
- Permite activar/desactivar el módulo globalmente

**Nivel de Usuario**:

- Campo `formsEnabled` en la tabla `users` (como `newsEnabled`, `inventoryEnabled`)
- Controla si el usuario ve el módulo en la navegación

**Nivel de Familia**:

- Como en otros módulos, los Admin Normales solo ven formularios de sus familias asignadas
- Super Admin ve todo

---

### 3. **Quién puede subir formularios**

| Rol              | Permisos                                             |
| ---------------- | ---------------------------------------------------- |
| **Super Admin**  | ✅ Crear/editar/eliminar TODOS los formularios       |
| **Admin Normal** | ✅ Crear/editar/eliminar formularios de SUS familias |
| **Técnico**      | ❌ No puede gestionar, solo descargar                |
| **Cliente**      | ❌ No puede gestionar, solo descargar                |

---

### 4. **Visibilidad de Formularios**

Cada formulario puede configurarse para ser visible por:

1. **Toda la organización**: No hay restricciones
2. **Por roles**: Solo ADMINs, solo Técnicos, etc.
3. **Por departamentos**: Solo Finanzas, solo Operaciones, etc.
4. **Por familias**: Solo Familia A, solo Familia B, etc.
5. **Por usuarios específicos**: Solo Juan y María

_(Exactamente el mismo patrón que el módulo de Noticias!)_

---

### 5. **Rutas y Navegación**

- **Admin**: `/admin/forms` (gestión completa)
- **Usuarios**: `/forms` o integrado en el dashboard (solo descarga)
- Categorías en sidebar: RH, Salud Ocupacional, Mantenimiento, etc.

---

## 🎯 Resumen de la Propuesta

**Ventajas de esta arquitectura**:
✅ Reutiliza patrones existentes (no reinventamos la rueda)
✅ Mismo UX que otros módulos (familiar para los usuarios)
✅ Fácil de mantener y escalar
✅ Control de acceso granular completo

---

¿Te parece bien esta estructura? ¡Confirmas y empezamos a implementar! 🚀

## User

y para activar el modulo quien puede gestionar imagino se lo puede hacer desde usuarios el super administrador asigna algo similar a como lo hace noticias y los formulario donde aparecerian en el frontend para cada usuario con su sesion iniciada

## Assistant

¡Exacto! Vamos a revisar cómo funciona actualmente la activación de módulos en tu sistema para replicar el mismo patrón:

¡Excelente! Ahora veo toda la arquitectura completa. Vamos a estructurar **exactamente como funciona el resto del sistema**:

---

## 🔑 1. Quién gestiona la activación del módulo

- **Super Admin**: Puede activar/desactivar el módulo para **cualquier usuario**
- **Admin Normal**: Puede activar/desactivar el módulo solo para **usuarios de sus familias asignadas**

Se hace desde la página de **Gestión de Usuarios** (`/admin/users`), en el modal de edición de usuario, con un simple **Switch** (igual que Noticias).

---

## 📋 2. Campo en Base de Datos

Agregamos un campo **`formsEnabled`** en la tabla `users` (exactamente como `newsEnabled`, `inventoryEnabled`, etc.):

- Tipo: Boolean
- Default: `false`
- Super Admin siempre lo tiene activo

---

## 🗂️ 3. Dónde aparecen los formularios en el Frontend

### Para Administradores:

- **Sidebar**: Nueva opción **"Formularios"** en la navegación de admin
- **Ruta**: `/admin/forms` (gestión completa: crear, editar, eliminar, categorías)

### Para Usuarios Normales (Técnicos, Clientes):

- **Opción 1**: Sidebar con opción **"Formularios"** (solo si `formsEnabled` es `true`)
- **Opción 2**: Widget en el Dashboard principal con acceso rápido a formularios
- **Ruta**: `/forms` (solo visualización y descarga)

---

## 🎯 4. Control de Acceso Granular por Formulario

Cada formulario individual puede configurarse para ser visible por:

1. **Toda la organización**: Sin restricciones
2. **Por Roles**: Solo ADMINs, solo Técnicos, etc.
3. **Por Departamentos**: Solo Finanzas, solo Operaciones, etc.
4. **Por Familias**: Solo Familia A, solo Familia B, etc.
5. **Por Usuarios Específicos**: Solo Juan y María

_(Exactamente el mismo patrón que el módulo de Noticias!)_

---

## 👥 5. Quién puede Subir Formularios

| Rol              | Permisos                                                                |
| ---------------- | ----------------------------------------------------------------------- |
| **Super Admin**  | ✅ Crear/editar/eliminar TODOS los formularios (todas las familias)     |
| **Admin Normal** | ✅ Crear/editar/eliminar formularios **solo de sus familias asignadas** |
| **Técnico**      | ❌ No puede gestionar, solo descargar                                   |
| **Cliente**      | ❌ No puede gestionar, solo descargar                                   |

---

## 📊 Resumen de la Arquitectura

```
✅ 1. Campo formsEnabled en tabla users
✅ 2. Switch en EditUserModal para activar/desactivar
✅ 3. Filtro en sidebar para ocultar/mostrar menú
✅ 4. Módulo /admin/forms para gestión
✅ 5. Módulo /forms para usuarios normales
✅ 6. Control de visibilidad por formulario (roles, depts, familias, usuarios)
```

---

¿Todo claro? ¡Confirmas y arrancamos! 🚀

## User

pero y si quiero asignar a un usuario en particular que pueda gestionar el modulo de formularios o tambien le podria llamar documentacion seria de revisar cual seria mejor el termino pero eso digo si quiero asignar un usuario en particular y que pueda asignar el super usuario que que familias puede gestionar si su familia nativa o las asignadas

## Assistant

¡Excelente punto! Vamos a analizarlo usando los **patrones existentes** en tu sistema (como el inventario) para que sea consistente.

## 1. 📝 Primero: Nombre del Módulo

Depende de **qué vas a almacenar**:

- Si es **solo formularios** (vacaciones, anticipos, permisos): → **"Formularios"**
- Si es **formularios + otros documentos** (manuales, políticas, guías): → **"Documentación y Formularios"** o **"Recursos y Formularios"**

Mi recomendación: **"Formularios y Documentos"** — es flexible y cubre ambos casos.

---

## 2. 🔐 Permisos: Patrón como el Inventario

Tu sistema ya tiene un patrón perfecto para esto con **`canManageInventory`** (permiso separado de solo tener el módulo habilitado). Vamos a replicarlo:

### Campos en la tabla `users`:

| Campo            | Tipo    | Descripción                                                                |
| ---------------- | ------- | -------------------------------------------------------------------------- |
| `formsEnabled`   | Boolean | ✅ El usuario **ve** el módulo en el sidebar y puede descargar formularios |
| `canManageForms` | Boolean | ✅ El usuario **gestiona** el módulo (crear/editar/eliminar formularios)   |

_(Exactamente como `inventoryEnabled` y `canManageInventory`!)_

---

## 3. 👥 Asignación de Familias para Gestión

Igual que con otros módulos:

### Para **Super Admin**:

- Ve **todas las familias**
- Puede gestionar formularios de **cualquier familia**

### Para **Admin Normal con `canManageForms = true`**:

- Solo ve y gestiona formularios de **las familias que le hayan sido asignadas**
- No puede gestionar formularios de familias fuera de su scope

---

## 4. 🎯 Resumen de Permisos Completos

| Configuración                               | ¿Ve el módulo? | ¿Descarga formularios? | ¿Gestiona formularios?    |
| ------------------------------------------- | -------------- | ---------------------- | ------------------------- |
| `formsEnabled: false`                       | ❌ No          | ❌ No                  | ❌ No                     |
| `formsEnabled: true, canManageForms: false` | ✅ Sí          | ✅ Sí                  | ❌ No                     |
| `formsEnabled: true, canManageForms: true`  | ✅ Sí          | ✅ Sí                  | ✅ Sí (solo sus familias) |

---

## 5. 🖥️ Cómo se configura en la UI

En el **modal de edición de usuario** (`/admin/users`), agregamos:

1. **Switch simple** para `formsEnabled` (igual que Noticias):
   - "Habilitar módulo de Formularios y Documentos"

2. **Switch adicional** para `canManageForms` (solo si `formsEnabled` está activado):
   - "Permitir gestión de formularios (crear/editar/eliminar)"

3. **Asignación de familias** (igual que Tickets/Inventario):
   - El Super Admin asigna qué familias puede gestionar el usuario
   - El usuario solo ve formularios de esas familias

---

## 📊 Ejemplo Práctico

- **Usuario Juan**:
  - `formsEnabled: true` → ve el módulo
  - `canManageForms: true` → puede gestionar
  - Familias asignadas: "Recursos Humanos", "Salud Ocupacional"
  - Resultado: Juan puede crear/editar formularios solo de esas 2 familias

- **Usuario María**:
  - `formsEnabled: true` → ve el módulo
  - `canManageForms: false` → solo descarga
  - Resultado: María ve y descarga formularios, pero no puede modificar nada

---

¿Te gusta esta estructura? ¿Confirmamos el nombre del módulo y empezamos? 🚀

## User

si me gusta la idea y el nombre del modulo como quedaria y dame todo el contexto de como seria el plan para la creacion de este modulo

## Assistant

¡Excelente! Vamos a definir todo detalladamente.

---

## 📌 Nombre Oficial del Módulo

**"Formularios y Documentos"**

Es flexible, cubre tanto formularios (vacaciones/anticipos/permisos y también documentos (manuales, políticas, guías, etc.)

---

## 🚀 Plan Completo de Implementación

Aquí tienes el plan estructurado **paso a paso**, siguiendo \*\*100% los patrones existentes en tu sistema:

---

### 📋 Fase 1: Base de Datos (Prisma Schema)

1. \*\*Agregar campos en la tabla `users`:
   - `formsEnabled` (Boolean, default: false)
   - `canManageForms` (Boolean, default: false)

2. **Agregar entrada en `system_modules`**:
   - key: `'forms'`
   - name: `'Formularios y Documentos'`
   - description: `'Gestión de formularios y documentos descargables'`
   - icon: `'FileText'` (de lucide-react)
   - defaultForAdmin: true
   - defaultForTech: false
   - defaultForClient: false

3. \*\*Crear tablas para el módulo:
   - `form_categories`: Categorías (RH, Salud Ocupacional, Mantenimiento, etc.)
   - `forms`: Formularios/documentos principales
   - `form_roles`: Visibilidad por roles
   - `form_users`: Visibilidad por usuarios
   - `form_departments`: Visibilidad por departamentos
   - `form_families`: Visibilidad por familias
   - `form_attachments`: Archivos adjuntos (PDF, Word, etc.)
   - `form_downloads`: Registro de descargas (estadísticas)

---

### 🔐 Fase 2: Autenticación y Autorización

1. **Actualizar `lib/auth.ts`**:
   - Incluir `formsEnabled` y `canManageForms` en el token JWT
   - Incluir estos campos en la sesión del usuario

2. **Actualizar `proxy.ts`**:
   - Permitir acceso a `/admin/forms` para usuarios con `formsEnabled: true`

3. **Actualizar `components/layout/role-dashboard-layout.tsx`**:
   - Agregar opción "Formularios y Documentos" en el sidebar
   - Ocultar la opción si el usuario no tiene `formsEnabled: true`

---

### 👥 Fase 3: Gestión de Usuarios

1. **Actualizar `EditUserModal` (`components/users/edit-user-modal.tsx`**:
   - Agregar Switch para `formsEnabled`
   - Agregar Switch para `canManageForms` (solo si `formsEnabled` está activado)
   - Agregar sección de asignación de familias para el módulo de forms
   - Actualizar el formulario de envío para incluir estos campos

2. \*\*Actualizar API de usuarios (`api/admin/users/[id]/route.ts`):
   - Incluir `formsEnabled` y `canManageForms` en las operaciones GET/PUT

---

### 🛠️ Fase 4: Componentes y Páginas del Módulo

#### Para Administración (`/admin/forms`):

1. **Página principal de listado**:
   - Filtrar por categoría, familia, estado
   - Vista de tabla y tarjetas
   - Estadísticas (total formularios, descargas totales, etc.)

2. **Página de creación/edición**:
   - Formulario para crear/editar formularios
   - Cargar archivo (PDF/Word/Excel)
   - Configurar visibilidad (roles, departamentos, familias, usuarios)
   - Seleccionar categoría
   - Asignar a familia(s)

3. **Componentes reutilizables**:
   - `FormCard`: Tarjeta de formulario
   - `FormFilters`: Filtros para el listado
   - `FormVisibilitySettings`: Configuración de visibilidad
   - `FormCategorySelector`: Selector de categorías

#### Para Usuarios Normales (`/forms`):

1. **Página principal**:
   - Listado de formularios visibles para el usuario
   - Filtrar por categoría
   - Buscador
   - Botón de descarga
   - Contador de descargas

---

### 📡 Fase 5: APIs

1. **APIs de Administración**:
   - `GET /api/admin/forms`: Listado de formularios (con filtros)
   - `POST /api/admin/forms`: Crear formulario
   - `GET /api/admin/forms/[id]`: Obtener formulario por ID
   - `PUT /api/admin/forms/[id]`: Actualizar formulario
   - `DELETE /api/admin/forms/[id]`: Eliminar formulario
   - `POST /api/admin/forms/[id]/upload`: Subir archivo
   - `GET /api/admin/form-categories`: Listado de categorías
   - `POST /api/admin/form-categories`: Crear categoría
   - `PUT /api/admin/form-categories/[id]`: Actualizar categoría
   - `DELETE /api/admin/form-categories/[id]`: Eliminar categoría

2. **APIs de Usuario**:
   - `GET /api/forms`: Listado de formularios visibles para el usuario autenticado
   - `GET /api/forms/[id]`: Obtener formulario por ID (solo si es visible
   - `POST /api/forms/[id]/download`: Registrar descarga

---

### 🎨 Fase 6: Integración en el Dashboard

- **Widget en Dashboard Principal**:
  - Mostrar formularios destacados o más descargados
  - Acceso rápido al módulo

---

### 📊 Fase 7: Seed y Datos Iniciales

- \*\*Agregar seed para categorías predeterminadas:
  - 🧑‍💼 Recursos Humanos
  - 🏥 Salud Ocupacional
  - 🔧 Mantenimiento
  - 📦 Logística
  - 📝 Otros

---

### ✅ Fase 8: Testing y Validación

1. Pruebas de permisos
2. Pruebas de visibilidad
3. Pruebas de descargas
4. Pruebas de gestión

---

## 📁 Estructura de Archivos (Resumen)

```
prisma/
  schema.prisma ← Nuevas tablas
  seeds/
    form-categories.seed.ts ← Seed de categorías

src/
  app/
    admin/
      forms/
        page.tsx ← Listado admin
        new/
          page.tsx ← Crear formulario
        [id]/
          page.tsx ← Editar formulario
      form-categories/
        page.tsx ← Gestión de categorías
    forms/
      page.tsx ← Pública para usuarios
    api/
      admin/
        forms/
          route.ts ← Listado/crear
          [id]/
            route.ts ← Obtener/actualizar/eliminar
            upload/
              route.ts ← Subir archivo
        form-categories/
          route.ts ← CRUD categorías
      forms/
        route.ts ← Listado para usuarios
        [id]/
          route.ts ← Obtener/descargar
  components/
    forms/
      index.ts
      form-card.tsx
      form-filters.tsx
      form-detail.tsx
      form-visibility-settings.tsx
      form-category-selector.tsx
  hooks/
    use-forms.ts ← Hook para formularios

```

---

## 🎯 Orden de Implementación (Prioridad)

1. \*\*Fase 1: Base de Datos
2. **Fase 2**: Autenticación y Autorización
3. **Fase 3**: Gestión de Usuarios
4. **Fase 4**: Componentes y Páginas
5. **Fase 5**: APIs
6. **Fase 6**: Integración Dashboard
7. **Fase 7**: Seed
8. **Fase 8**: Testing

---

¡Listo! Este plan sigue \*\*100% los patrones existentes en tu sistema, es mantenible y escalable.

¿Confirmamos y empezamos? 🚀

## User

me gusta podemos inicar la creacion de este modulo pero no es necesario los seeders ni datos iniciales eso lo hariamos manualmente y debe ser similar al todo el sistema la ui responsivo la misma estructura de colores para los temas del proyecto

## Assistant

¡Excelente! Empezamos. Primero creamos el plan de tareas y luego vamos paso a paso.

Comenzamos con la **Fase 1: Actualizar Prisma Schema**. Primero leemos el final del schema para agregar las nuevas tablas:

Ahora actualizamos el schema.prisma:

Ahora agregamos las relaciones en el modelo users:

Ahora agregamos todas las tablas del módulo al final del schema:

¡Excelente! Schema actualizado. Ahora actualizamos el plan y pasamos a la Fase 2:

Ahora actualizamos `lib/auth.ts`:

Ahora actualizamos `lib/auth.ts` para incluir los nuevos campos:

Vamos a hacer las modificaciones con Edit:

Ahora actualizamos el session callback:

¡Perfecto! Ahora actualizamos el plan y pasamos a la Fase 3:

Ahora actualizamos `proxy.ts`:

¡Genial! Ahora actualizamos el plan y pasamos a la Fase 4:

Ahora actualizamos el sidebar en `role-dashboard-layout.tsx`:

Primero, agregamos la opción en la navegación de ADMIN:

Ahora agregamos la opción en TECHNICIAN:

Vamos a hacerlos uno por uno con más contexto:

Ahora TECHNICIAN_MANAGER:

Ahora CLIENT:

Ahora actualizamos el filtro de visibilidad del sidebar para ocultar la opción si el usuario no tiene `formsEnabled`:

Primero, revisamos cómo se obtienen las variables `hasNews`, `hasPatrols`, etc.:

Primero, revisemos el hook `useUserModules`:

Ahora actualizamos `use-user-modules.ts`:

Ahora actualizamos `role-dashboard-layout.tsx`:

Ahora actualizamos el primer filtro (para ADMIN):

Ahora actualizamos el segundo filtro (para TECHNICIAN y CLIENT):

¡Excelente! Ahora actualizamos el plan y pasamos a la Fase 5:

Ahora actualizamos `EditUserModal`:

Ahora actualizamos el estado inicial de formData:

Ahora actualizamos la sección donde se carga el usuario en formData:

Ahora agregamos los switches en la UI. Primero, buscamos la sección donde está el switch de Noticias:

Ahora agregamos los switches de Formularios:

Ahora actualizamos UserModulesPanel para incluir los nuevos campos:

Primero, actualicemos la definición de `UserModulesPanel`. Vamos a buscarla:

Perfecto! Vamos a leer y actualizar `user-modules-panel.tsx`:

Ahora actualizamos `user-modules-panel.tsx`:

## User

continua te quedaste

## Assistant

¡Claro! Continuemos actualizando `user-modules-panel.tsx` para incluir los campos de formularios:

¡Excelente! Ahora actualicemos la API `/api/user/modules` para que incluya el campo `forms`:

Perfecto! Ahora actualicemos esta API:
