# ✅ Prueba de Registro Manual - Guía Paso a Paso

## 🎯 Objetivo
Verificar que el registro manual de usuarios funciona correctamente.

---

## 📋 Pre-requisitos

1. ✅ Sistema corriendo: `npm run dev`
2. ✅ Base de datos conectada
3. ✅ Variables de entorno configuradas (`.env` y `.env.local`)

---

## 🧪 Pasos de Prueba

### 1. Acceder a la página de registro

**URL:** http://localhost:3000/register

**Verificar que se muestra:**
- ✅ Título "Crear Cuenta"
- ✅ Formulario con campos:
  - Nombre completo
  - Email
  - Contraseña (con botón mostrar/ocultar)
  - Confirmar contraseña (con botón mostrar/ocultar)
  - Teléfono (opcional)
- ✅ Botón "Crear Cuenta"
- ✅ Separador "O continúa con"
- ✅ Botones de Google y Microsoft
- ✅ Link "¿Ya tienes cuenta? Inicia sesión aquí"

---

### 2. Probar validaciones (campos vacíos)

**Acción:** Click en "Crear Cuenta" sin llenar nada

**Resultado esperado:**
- ❌ Mensaje de error bajo "Nombre": "El nombre es requerido"
- ❌ Mensaje de error bajo "Email": "El email es requerido"
- ❌ Mensaje de error bajo "Contraseña": "La contraseña es requerida"
- ❌ Mensaje de error bajo "Confirmar": "Confirma tu contraseña"

---

### 3. Probar validación de nombre corto

**Datos:**
- Nombre: `A`
- Email: `test@test.com`
- Contraseña: `123456`
- Confirmar: `123456`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
- ❌ Mensaje de error: "El nombre debe tener al menos 2 caracteres"

---

### 4. Probar validación de email inválido

**Datos:**
- Nombre: `Juan Pérez`
- Email: `emailinvalido`
- Contraseña: `123456`
- Confirmar: `123456`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
- ❌ Mensaje de error: "Email inválido"

---

### 5. Probar validación de contraseña corta

**Datos:**
- Nombre: `Juan Pérez`
- Email: `test@test.com`
- Contraseña: `123`
- Confirmar: `123`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
- ❌ Mensaje de error: "La contraseña debe tener al menos 6 caracteres"

---

### 6. Probar validación de contraseñas no coinciden

**Datos:**
- Nombre: `Juan Pérez`
- Email: `test@test.com`
- Contraseña: `123456`
- Confirmar: `654321`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
- ❌ Mensaje de error: "Las contraseñas no coinciden"

---

### 7. Probar validación de teléfono inválido

**Datos:**
- Nombre: `Juan Pérez`
- Email: `test@test.com`
- Contraseña: `123456`
- Confirmar: `123456`
- Teléfono: `abc123`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
- ❌ Mensaje de error: "Teléfono inválido"

---

### 8. Registro exitoso (SIN teléfono)

**Datos:**
- Nombre: `Juan Pérez`
- Email: `juan.perez@test.com`
- Contraseña: `123456`
- Confirmar: `123456`
- Teléfono: *(dejar vacío)*

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
1. ✅ Botón muestra "Creando cuenta..." con spinner
2. ✅ Mensaje verde: "¡Cuenta creada exitosamente! Redirigiendo al login..."
3. ✅ Después de 2 segundos, redirige a `/login?registered=true`
4. ✅ En la página de login, puede iniciar sesión con:
   - Email: `juan.perez@test.com`
   - Contraseña: `123456`
5. ✅ Después de login, redirige a `/client` (dashboard de cliente)

---

### 9. Registro exitoso (CON teléfono)

**Datos:**
- Nombre: `María García`
- Email: `maria.garcia@test.com`
- Contraseña: `password123`
- Confirmar: `password123`
- Teléfono: `+52 123 456 7890`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
1. ✅ Registro exitoso
2. ✅ Redirige a login
3. ✅ Puede iniciar sesión
4. ✅ Teléfono guardado en la base de datos

---

### 10. Probar email duplicado

**Datos:**
- Nombre: `Otro Usuario`
- Email: `juan.perez@test.com` *(mismo del paso 8)*
- Contraseña: `123456`
- Confirmar: `123456`

**Acción:** Click en "Crear Cuenta"

**Resultado esperado:**
- ❌ Mensaje de error bajo "Email": "Este email ya está registrado"
- ❌ NO se crea usuario duplicado

---

### 11. Verificar botones mostrar/ocultar contraseña

**Acción:** 
1. Escribir contraseña
2. Click en ícono de ojo en campo "Contraseña"
3. Click en ícono de ojo en campo "Confirmar contraseña"

**Resultado esperado:**
- ✅ Contraseña se muestra como texto plano
- ✅ Click de nuevo oculta la contraseña
- ✅ Ambos campos funcionan independientemente

---

### 12. Verificar link a login

**Acción:** Click en "Inicia sesión aquí"

**Resultado esperado:**
- ✅ Redirige a `/login`

---

### 13. Verificar en base de datos

**Comando SQL:**
```sql
SELECT id, name, email, role, phone, isActive, isEmailVerified, createdAt 
FROM User 
WHERE email IN ('juan.perez@test.com', 'maria.garcia@test.com')
ORDER BY createdAt DESC;
```

**Resultado esperado:**
```
id | name          | email                    | role   | phone            | isActive | isEmailVerified | createdAt
---|---------------|--------------------------|--------|------------------|----------|-----------------|----------
2  | María García  | maria.garcia@test.com    | CLIENT | +52 123 456 7890 | true     | false           | 2026-01-20...
1  | Juan Pérez    | juan.perez@test.com      | CLIENT | null             | true     | false           | 2026-01-20...
```

**Verificar:**
- ✅ `role` = `CLIENT`
- ✅ `isActive` = `true`
- ✅ `isEmailVerified` = `false`
- ✅ `passwordHash` existe (no es null)
- ✅ `passwordHash` NO es la contraseña en texto plano (debe ser hash bcrypt)

---

### 14. Verificar log de auditoría

**Comando SQL:**
```sql
SELECT action, entityType, entityId, userEmail, details, createdAt
FROM AuditLog
WHERE action = 'USER_REGISTERED'
ORDER BY createdAt DESC
LIMIT 2;
```

**Resultado esperado:**
```
action          | entityType | entityId | userEmail                | details                                    | createdAt
----------------|------------|----------|--------------------------|--------------------------------------------|-----------
USER_REGISTERED | User       | 2        | maria.garcia@test.com    | {"name":"María García","role":"CLIENT"...} | 2026-01-20...
USER_REGISTERED | User       | 1        | juan.perez@test.com      | {"name":"Juan Pérez","role":"CLIENT"...}   | 2026-01-20...
```

**Verificar:**
- ✅ Se creó log para cada registro
- ✅ `registrationMethod` = `manual`

---

## 🎨 Verificaciones de UI

### Estados visuales

1. **Estado normal:**
   - ✅ Campos con borde gris
   - ✅ Íconos visibles (User, Mail, Lock, Phone)
   - ✅ Placeholders claros

2. **Estado con error:**
   - ✅ Campo con borde rojo
   - ✅ Mensaje de error en rojo debajo del campo
   - ✅ Ícono de alerta junto al mensaje

3. **Estado deshabilitado (durante submit):**
   - ✅ Todos los campos deshabilitados
   - ✅ Botón muestra spinner
   - ✅ Texto "Creando cuenta..."

4. **Estado de éxito:**
   - ✅ Alert verde con check
   - ✅ Mensaje "¡Cuenta creada exitosamente!"

---

## 🔒 Verificaciones de Seguridad

### 1. Contraseña hasheada

**Verificar en DB:**
```sql
SELECT email, passwordHash FROM User WHERE email = 'juan.perez@test.com';
```

**Resultado esperado:**
- ✅ `passwordHash` empieza con `$2a$` o `$2b$` (bcrypt)
- ✅ `passwordHash` tiene ~60 caracteres
- ✅ NO es la contraseña en texto plano

### 2. Email en minúsculas

**Verificar:**
- ✅ Si registro con `JUAN.PEREZ@TEST.COM`
- ✅ Se guarda como `juan.perez@test.com`

### 3. Trim de espacios

**Verificar:**
- ✅ Si registro con `  Juan Pérez  `
- ✅ Se guarda como `Juan Pérez` (sin espacios)

---

## 📊 Checklist Final

- [ ] Formulario se muestra correctamente
- [ ] Todas las validaciones funcionan
- [ ] Registro exitoso sin teléfono
- [ ] Registro exitoso con teléfono
- [ ] Email duplicado es rechazado
- [ ] Contraseña se hashea correctamente
- [ ] Usuario se crea con rol CLIENT
- [ ] Redirige a login después de registro
- [ ] Puede iniciar sesión con credenciales nuevas
- [ ] Log de auditoría se crea
- [ ] Botones mostrar/ocultar contraseña funcionan
- [ ] Link a login funciona
- [ ] UI se ve bien en desktop
- [ ] UI se ve bien en móvil
- [ ] Mensajes de error son claros
- [ ] Mensaje de éxito es claro

---

## 🐛 Problemas Comunes

### Error: "Error de conexión"
**Causa:** Base de datos no está corriendo  
**Solución:** Verificar que PostgreSQL esté activo

### Error: "Error al registrar usuario"
**Causa:** Problema con Prisma o variables de entorno  
**Solución:** 
1. Verificar `DATABASE_URL` en `.env`
2. Ejecutar `npx prisma generate`
3. Reiniciar servidor

### Error: "client_id is required" (OAuth)
**Causa:** Botones OAuth sin configurar  
**Solución:** Normal, OAuth se configura después. El registro manual debe funcionar.

---

## ✅ Resultado Esperado Final

**Después de completar todas las pruebas:**

1. ✅ Usuarios pueden registrarse manualmente
2. ✅ Todas las validaciones funcionan
3. ✅ Contraseñas se hashean correctamente
4. ✅ Emails duplicados son rechazados
5. ✅ Usuarios se crean con rol CLIENT
6. ✅ Pueden iniciar sesión inmediatamente
7. ✅ Sistema está listo para uso en producción

---

**¡Sistema de registro manual completado! 🎉**
