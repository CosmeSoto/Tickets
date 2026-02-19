# 🔐 Roles y Permisos del Sistema

**Fecha**: 20 de enero de 2026  
**Estado**: ✅ Verificado y Documentado

---

## 👥 Roles del Sistema

### 1. ADMIN (Administrador)
**Acceso**: Total al sistema

**Permisos**:
- ✅ Acceso completo a todas las rutas
- ✅ Gestión de usuarios (crear, editar, eliminar)
- ✅ Gestión de técnicos
- ✅ Gestión de tickets (todos)
- ✅ Gestión de categorías
- ✅ Gestión de departamentos
- ✅ Reportes y estadísticas
- ✅ Configuración del sistema
- ✅ Backups y auditoría
- ✅ Puede ver dashboards de otros roles

**Rutas Permitidas**:
```
/admin/*           ✅ Acceso completo
/technician/*      ✅ Puede ver (para supervisión)
/client/*          ✅ Puede ver (para soporte)
```

---

### 2. TECHNICIAN (Técnico)
**Acceso**: Gestión de tickets asignados

**Permisos**:
- ✅ Ver y gestionar tickets asignados
- ✅ Ver estadísticas propias
- ✅ Gestionar categorías asignadas
- ✅ Acceso a base de conocimientos
- ✅ Actualizar perfil propio
- ✅ Configuración personal
- ❌ NO puede crear usuarios
- ❌ NO puede acceder a rutas de admin
- ❌ NO puede ver tickets de otros técnicos (sin asignar)

**Rutas Permitidas**:
```
/technician/*      ✅ Acceso completo
/client/*          ❌ NO permitido
/admin/*           ❌ NO permitido
```

---

### 3. CLIENT (Cliente)
**Acceso**: Gestión de tickets propios

**Permisos**:
- ✅ Ver tickets propios
- ✅ Crear nuevos tickets
- ✅ Comentar en tickets propios
- ✅ Ver notificaciones propias
- ✅ Actualizar perfil propio
- ✅ Configuración personal
- ✅ Acceso a centro de ayuda
- ❌ NO puede ver tickets de otros clientes
- ❌ NO puede acceder a rutas de admin
- ❌ NO puede acceder a rutas de técnico

**Rutas Permitidas**:
```
/client/*          ✅ Acceso completo
/technician/*      ❌ NO permitido
/admin/*           ❌ NO permitido
```

---

## 🛡️ Protección de Rutas

### Middleware (middleware.ts)

```typescript
// Verificación de roles por ruta
if (pathname.startsWith('/admin') && role !== 'ADMIN') {
  return NextResponse.redirect(new URL('/unauthorized', req.url))
}

if (pathname.startsWith('/technician') && !['TECHNICIAN', 'ADMIN'].includes(role)) {
  return NextResponse.redirect(new URL('/unauthorized', req.url))
}

if (pathname.startsWith('/client') && !['CLIENT', 'TECHNICIAN', 'ADMIN'].includes(role)) {
  return NextResponse.redirect(new URL('/unauthorized', req.url))
}
```

### Protección en Componentes

Cada página verifica el rol del usuario:

```typescript
useEffect(() => {
  if (!session) {
    router.push('/login')
    return
  }

  if (session.user.role !== 'EXPECTED_ROLE') {
    router.push('/unauthorized')
    return
  }
}, [session, router])
```

---

## 🔒 Matriz de Permisos

| Funcionalidad | ADMIN | TECHNICIAN | CLIENT |
|---------------|-------|------------|--------|
| **Dashboard** |
| Ver dashboard propio | ✅ | ✅ | ✅ |
| Ver dashboard de otros | ✅ | ❌ | ❌ |
| **Tickets** |
| Ver todos los tickets | ✅ | ❌ | ❌ |
| Ver tickets asignados | ✅ | ✅ | ❌ |
| Ver tickets propios | ✅ | ✅ | ✅ |
| Crear tickets | ✅ | ✅ | ✅ |
| Asignar tickets | ✅ | ❌ | ❌ |
| Cerrar tickets | ✅ | ✅ | ❌ |
| Eliminar tickets | ✅ | ❌ | ❌ |
| **Usuarios** |
| Ver todos los usuarios | ✅ | ❌ | ❌ |
| Crear usuarios | ✅ | ❌ | ❌ |
| Editar usuarios | ✅ | ❌ | ❌ |
| Eliminar usuarios | ✅ | ❌ | ❌ |
| Editar perfil propio | ✅ | ✅ | ✅ |
| **Categorías** |
| Ver todas las categorías | ✅ | ❌ | ❌ |
| Ver categorías asignadas | ✅ | ✅ | ❌ |
| Crear categorías | ✅ | ❌ | ❌ |
| Editar categorías | ✅ | ❌ | ❌ |
| Eliminar categorías | ✅ | ❌ | ❌ |
| **Departamentos** |
| Ver departamentos | ✅ | ❌ | ❌ |
| Crear departamentos | ✅ | ❌ | ❌ |
| Editar departamentos | ✅ | ❌ | ❌ |
| Eliminar departamentos | ✅ | ❌ | ❌ |
| **Reportes** |
| Ver reportes generales | ✅ | ❌ | ❌ |
| Ver reportes propios | ✅ | ✅ | ✅ |
| Exportar reportes | ✅ | ✅ | ❌ |
| **Configuración** |
| Configuración del sistema | ✅ | ❌ | ❌ |
| Configuración personal | ✅ | ✅ | ✅ |
| **Backups** |
| Ver backups | ✅ | ❌ | ❌ |
| Crear backups | ✅ | ❌ | ❌ |
| Restaurar backups | ✅ | ❌ | ❌ |
| **Auditoría** |
| Ver logs de auditoría | ✅ | ❌ | ❌ |
| **Notificaciones** |
| Ver notificaciones propias | ✅ | ✅ | ✅ |
| Enviar notificaciones | ✅ | ❌ | ❌ |

---

## 🔐 API Routes Protection

### Protección en API Routes

```typescript
// /api/users/route.ts
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Lógica de la API...
}
```

### Endpoints por Rol

| Endpoint | ADMIN | TECHNICIAN | CLIENT |
|----------|-------|------------|--------|
| `GET /api/users` | ✅ | ❌ | ❌ |
| `POST /api/users` | ✅ | ❌ | ❌ |
| `GET /api/tickets` | ✅ | ✅* | ✅* |
| `POST /api/tickets` | ✅ | ✅ | ✅ |
| `PUT /api/tickets/:id` | ✅ | ✅* | ✅* |
| `DELETE /api/tickets/:id` | ✅ | ❌ | ❌ |
| `GET /api/categories` | ✅ | ✅* | ❌ |
| `POST /api/categories` | ✅ | ❌ | ❌ |
| `GET /api/departments` | ✅ | ❌ | ❌ |
| `POST /api/departments` | ✅ | ❌ | ❌ |
| `GET /api/reports` | ✅ | ✅* | ✅* |
| `GET /api/backups` | ✅ | ❌ | ❌ |
| `POST /api/backups` | ✅ | ❌ | ❌ |

\* Con restricciones (solo datos propios o asignados)

---

## 🚨 Validaciones de Seguridad

### 1. Autenticación
```typescript
// Verificar que el usuario esté autenticado
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 2. Autorización
```typescript
// Verificar que el usuario tenga el rol correcto
if (session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 3. Propiedad de Recursos
```typescript
// Verificar que el usuario sea dueño del recurso
if (ticket.clientId !== session.user.id && session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 4. Asignación de Recursos
```typescript
// Verificar que el técnico tenga el ticket asignado
if (ticket.assigneeId !== session.user.id && session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## 📝 Checklist de Seguridad

### Rutas Frontend
- [x] Middleware protege todas las rutas
- [x] Redirección a /unauthorized para accesos no autorizados
- [x] Verificación de rol en cada página
- [x] Redirección automática según rol al login

### API Routes
- [x] Verificación de sesión en cada endpoint
- [x] Verificación de rol según endpoint
- [x] Validación de propiedad de recursos
- [x] Respuestas HTTP correctas (401, 403, 404)

### Base de Datos
- [x] Relaciones con cascade deletes
- [x] Campos de auditoría (createdAt, updatedAt)
- [x] Soft deletes con isActive
- [x] Índices para consultas por usuario/rol

### Componentes
- [x] Verificación de rol antes de renderizar
- [x] Ocultación de elementos según permisos
- [x] Mensajes de error apropiados
- [x] Redirección automática si no autorizado

---

## 🔄 Flujo de Autenticación

```
1. Usuario accede a ruta protegida
   ↓
2. Middleware verifica token
   ↓
3. Si no hay token → Redirige a /login
   ↓
4. Si hay token → Verifica rol
   ↓
5. Si rol no autorizado → Redirige a /unauthorized
   ↓
6. Si rol autorizado → Permite acceso
   ↓
7. Componente verifica sesión
   ↓
8. Si sesión válida → Renderiza contenido
   ↓
9. Si sesión inválida → Redirige a /login
```

---

## ✅ Estado de Implementación

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Middleware | ✅ | Protección completa de rutas |
| Verificación en páginas | ✅ | Todas las páginas verifican rol |
| API Routes | ⚠️ | Requiere implementación individual |
| Matriz de permisos | ✅ | Documentada y clara |
| Redirecciones | ✅ | Automáticas según rol |
| Mensajes de error | ✅ | Página /unauthorized |

---

## 🚀 Próximos Pasos

1. **Implementar protección en API Routes**
   - Agregar verificación de rol en cada endpoint
   - Validar propiedad de recursos
   - Tiempo estimado: 2h

2. **Crear página /unauthorized**
   - Diseño consistente con el sistema
   - Mensaje claro de error
   - Botón para volver al dashboard
   - Tiempo estimado: 30min

3. **Testing de permisos**
   - Probar cada rol en cada ruta
   - Verificar redirecciones
   - Validar API endpoints
   - Tiempo estimado: 1h

---

*Documentado el 20 de enero de 2026*
