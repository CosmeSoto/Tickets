# 🚀 Guía Paso a Paso - Configuración OAuth

## 📋 Información Importante

**Redirect URIs que necesitarás:**
- Google: `http://localhost:3000/api/auth/callback/google`
- Microsoft: `http://localhost:3000/api/auth/callback/azure-ad`

**Para producción, cambia `localhost:3000` por tu dominio real.**

---

## 🔵 PARTE 1: Configurar Google OAuth

### Paso 1: Acceder a Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Inicia sesión con tu cuenta de Google

### Paso 2: Crear o Seleccionar un Proyecto

**Opción A - Crear Nuevo Proyecto:**
1. Click en el selector de proyectos (arriba a la izquierda)
2. Click en "NUEVO PROYECTO"
3. Nombre del proyecto: `Sistema de Tickets` (o el nombre que prefieras)
4. Click en "CREAR"
5. Espera unos segundos y selecciona el proyecto creado

**Opción B - Usar Proyecto Existente:**
1. Selecciona tu proyecto existente del menú desplegable

### Paso 3: Habilitar Google+ API

1. En el menú lateral, ve a: **APIs y servicios** → **Biblioteca**
2. Busca: `Google+ API`
3. Click en "Google+ API"
4. Click en "HABILITAR"
5. Espera a que se habilite (puede tardar unos segundos)

### Paso 4: Configurar Pantalla de Consentimiento OAuth

1. Ve a: **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. Selecciona: **Externo** (para permitir cualquier cuenta de Google)
3. Click en "CREAR"

**Información de la aplicación:**
- Nombre de la aplicación: `Sistema de Tickets`
- Correo de asistencia: Tu email
- Logo de la aplicación: (opcional)

**Información de contacto del desarrollador:**
- Dirección de correo: Tu email

4. Click en "GUARDAR Y CONTINUAR"

**Permisos:**
5. Click en "AGREGAR O QUITAR PERMISOS"
6. Selecciona estos permisos:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
7. Click en "ACTUALIZAR"
8. Click en "GUARDAR Y CONTINUAR"

**Usuarios de prueba (opcional):**
9. Si quieres, agrega emails de prueba
10. Click en "GUARDAR Y CONTINUAR"

**Resumen:**
11. Revisa la información
12. Click en "VOLVER AL PANEL"

### Paso 5: Crear Credenciales OAuth 2.0

1. Ve a: **APIs y servicios** → **Credenciales**
2. Click en "CREAR CREDENCIALES" (arriba)
3. Selecciona: **ID de cliente de OAuth 2.0**

**Configuración:**
- Tipo de aplicación: **Aplicación web**
- Nombre: `Sistema de Tickets - Web`

**Orígenes de JavaScript autorizados:**
4. Click en "AGREGAR URI"
5. Ingresa: `http://localhost:3000`

**URIs de redirección autorizados:**
6. Click en "AGREGAR URI"
7. Ingresa: `http://localhost:3000/api/auth/callback/google`

8. Click en "CREAR"

### Paso 6: Copiar Credenciales

**¡IMPORTANTE! Aparecerá un modal con tus credenciales:**

```
ID de cliente: 123456789-abc123def456.apps.googleusercontent.com
Secreto de cliente: GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
```

**📋 COPIA ESTOS VALORES AHORA** (puedes descargarlos como JSON también)

Si cierras el modal, puedes volver a ver las credenciales:
1. Click en el nombre de tu credencial en la lista
2. Verás el "ID de cliente" y el "Secreto de cliente"

---

## 🔷 PARTE 2: Configurar Microsoft OAuth (Azure AD)

### Paso 1: Acceder a Azure Portal

1. Ve a: https://portal.azure.com/
2. Inicia sesión con tu cuenta de Microsoft

### Paso 2: Ir a Azure Active Directory

1. En el menú lateral o buscador, busca: **Azure Active Directory**
2. Click en "Azure Active Directory"

### Paso 3: Registrar una Aplicación

1. En el menú lateral, click en: **Registros de aplicaciones**
2. Click en "NUEVO REGISTRO" (arriba)

**Configuración del registro:**
- Nombre: `Sistema de Tickets`
- Tipos de cuenta compatibles: Selecciona:
  - **Cuentas en cualquier directorio organizativo (cualquier directorio de Azure AD: multiinquilino) y cuentas personales de Microsoft (por ejemplo, Skype, Xbox)**
  
  *(Esto permite tanto cuentas personales como organizacionales)*

**URI de redirección:**
3. Selecciona: **Web**
4. Ingresa: `http://localhost:3000/api/auth/callback/azure-ad`

5. Click en "REGISTRAR"

### Paso 4: Copiar Application (Client) ID

**En la página de información general de tu aplicación:**

1. Busca: **Id. de aplicación (cliente)**
2. Copia este valor (ejemplo: `12345678-1234-1234-1234-123456789012`)

**📋 GUARDA ESTE ID**

### Paso 5: Crear Client Secret

1. En el menú lateral, click en: **Certificados y secretos**
2. Click en la pestaña: **Secretos de cliente**
3. Click en "NUEVO SECRETO DE CLIENTE"

**Configuración:**
- Descripción: `Sistema de Tickets - Secret`
- Expira: Selecciona `24 meses` (o el tiempo que prefieras)

4. Click en "AGREGAR"

**¡IMPORTANTE! El secreto se mostrará UNA SOLA VEZ:**

```
Valor: abc123def456ghi789jkl012mno345pqr678stu
```

**📋 COPIA ESTE VALOR AHORA** (no podrás verlo después)

### Paso 6: Configurar Permisos de API

1. En el menú lateral, click en: **Permisos de API**
2. Verifica que tengas estos permisos (deberían estar por defecto):
   - `User.Read` (Microsoft Graph)
   - `openid`
   - `profile`
   - `email`

Si no están, agrégalos:
3. Click en "AGREGAR UN PERMISO"
4. Selecciona "Microsoft Graph"
5. Selecciona "Permisos delegados"
6. Busca y selecciona: `User.Read`, `openid`, `profile`, `email`
7. Click en "AGREGAR PERMISOS"

### Paso 7: Copiar Tenant ID (Opcional)

**Si quieres restringir a un tenant específico:**

1. Ve a la página de **Información general** de tu aplicación
2. Copia el **Id. de directorio (inquilino)**

**Para permitir cuentas personales y organizacionales, usa: `common`**

---

## 🎯 PARTE 3: Configurar en tu Sistema

### Paso 1: Acceder a la Configuración OAuth

1. Ve a: http://localhost:3000/login
2. Inicia sesión como ADMIN
3. Ve a: **Configuración** (en el sidebar)
4. Click en la pestaña: **OAuth**

### Paso 2: Configurar Google OAuth

**En la tarjeta "Google OAuth":**

1. **Redirect URI**: Ya está mostrado, verifica que sea:
   ```
   http://localhost:3000/api/auth/callback/google
   ```

2. **Client ID**: Pega el ID que copiaste de Google Cloud Console
   ```
   123456789-abc123def456.apps.googleusercontent.com
   ```

3. **Client Secret**: Pega el Secret que copiaste
   ```
   GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
   ```

4. **Habilitar Google OAuth**: ✅ Marca el checkbox

5. Click en: **Guardar Configuración de Google**

**Deberías ver un mensaje de éxito:** ✅ "Configuración guardada"

### Paso 3: Configurar Microsoft OAuth

**En la tarjeta "Microsoft OAuth":**

1. **Redirect URI**: Ya está mostrado, verifica que sea:
   ```
   http://localhost:3000/api/auth/callback/azure-ad
   ```

2. **Application (Client) ID**: Pega el ID que copiaste de Azure Portal
   ```
   12345678-1234-1234-1234-123456789012
   ```

3. **Client Secret**: Pega el Secret que copiaste
   ```
   abc123def456ghi789jkl012mno345pqr678stu
   ```

4. **Tenant ID**: Deja `common` (para permitir cuentas personales y organizacionales)
   - Si quieres solo tu organización, pega tu Tenant ID específico

5. **Habilitar Microsoft OAuth**: ✅ Marca el checkbox

6. Click en: **Guardar Configuración de Microsoft**

**Deberías ver un mensaje de éxito:** ✅ "Configuración guardada"

---

## 🧪 PARTE 4: Probar la Configuración

### Paso 1: Cerrar Sesión

1. Click en tu avatar (arriba a la derecha)
2. Click en "Cerrar sesión"

### Paso 2: Ir a la Página de Registro

1. Ve a: http://localhost:3000/register

**Deberías ver:**
- ✅ Botón "Continuar con Google" (con logo de Google)
- ✅ Botón "Continuar con Microsoft" (con logo de Microsoft)

### Paso 3: Probar Google OAuth

1. Click en "Continuar con Google"
2. Selecciona tu cuenta de Google
3. Acepta los permisos solicitados
4. **Deberías ser redirigido al dashboard como CLIENT**

### Paso 4: Probar Microsoft OAuth

1. Cierra sesión
2. Ve a: http://localhost:3000/register
3. Click en "Continuar con Microsoft"
4. Ingresa tu email de Microsoft
5. Ingresa tu contraseña
6. Acepta los permisos solicitados
7. **Deberías ser redirigido al dashboard como CLIENT**

---

## ✅ Verificación Final

### Verifica que los usuarios se crearon correctamente:

1. Inicia sesión como ADMIN
2. Ve a: **Usuarios** (en el sidebar)
3. Deberías ver los usuarios creados con OAuth:
   - Avatar de Google/Microsoft
   - Email de la cuenta OAuth
   - Rol: CLIENT
   - OAuth Provider: google o azure-ad

---

## 🐛 Solución de Problemas

### Error: "redirect_uri_mismatch" (Google)

**Causa:** El Redirect URI no coincide

**Solución:**
1. Ve a Google Cloud Console → Credenciales
2. Edita tu credencial OAuth 2.0
3. Verifica que el URI sea exactamente: `http://localhost:3000/api/auth/callback/google`
4. Guarda los cambios
5. Espera 5 minutos y vuelve a intentar

### Error: "invalid_client" (Microsoft)

**Causa:** Client ID o Secret incorrectos

**Solución:**
1. Ve a Azure Portal → Tu aplicación
2. Verifica el Application (Client) ID
3. Si el secret expiró, crea uno nuevo en "Certificados y secretos"
4. Actualiza las credenciales en la UI de configuración

### Error: "access_denied"

**Causa:** El usuario canceló o no tiene permisos

**Solución:**
- Vuelve a intentar y acepta los permisos
- Verifica que la cuenta de prueba esté autorizada (Google)

### Los botones OAuth no aparecen

**Causa:** Los proveedores no están habilitados

**Solución:**
1. Ve a Configuración → OAuth
2. Verifica que los checkboxes estén marcados
3. Guarda nuevamente la configuración
4. Recarga la página de registro

---

## 📝 Notas Importantes

### Seguridad

- ✅ Los Client Secrets se encriptan automáticamente en la base de datos
- ✅ Nunca se muestran completos en la UI
- ✅ Solo usuarios ADMIN pueden configurar OAuth

### Producción

Cuando despliegues a producción:

1. **Actualiza los Redirect URIs** en Google y Microsoft:
   - Google: `https://tu-dominio.com/api/auth/callback/google`
   - Microsoft: `https://tu-dominio.com/api/auth/callback/azure-ad`

2. **Actualiza los Orígenes autorizados** (Google):
   - `https://tu-dominio.com`

3. **Actualiza NEXTAUTH_URL** en `.env`:
   ```
   NEXTAUTH_URL="https://tu-dominio.com"
   ```

4. **Genera un nuevo NEXTAUTH_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

### Usuarios OAuth

- Se crean automáticamente con rol **CLIENT**
- No tienen contraseña (solo pueden iniciar sesión con OAuth)
- Su email es el de la cuenta OAuth
- Su nombre es el de la cuenta OAuth
- Su avatar es el de la cuenta OAuth

---

## 🎉 ¡Listo!

Ahora tu sistema tiene autenticación OAuth completamente funcional con Google y Microsoft.

Los usuarios pueden:
- ✅ Registrarse con Google
- ✅ Registrarse con Microsoft
- ✅ Iniciar sesión con Google
- ✅ Iniciar sesión con Microsoft
- ✅ Usar el sistema como clientes

**¿Necesitas ayuda?** Revisa la sección de Solución de Problemas o consulta los logs del servidor.
