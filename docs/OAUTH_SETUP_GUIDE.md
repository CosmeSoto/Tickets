# Guía de OAuth (Google y Microsoft)

Esta guía explica **paso a paso** cómo permitir que los usuarios entren o se registren con su cuenta de **Gmail (Google)** o **Outlook / Hotmail (Microsoft)**.

> **No necesitas ser programador.** Solo necesitas acceso de administrador al sistema y, en Google o Microsoft, crear una “aplicación” que autorice el inicio de sesión.

---

## ¿Qué lograrás al terminar?

| Resultado | Descripción |
|-----------|-------------|
| Botones en login | En `/login` y `/register` aparecerán “Google” y/o “Microsoft” |
| Registro automático | Quien entre por primera vez con OAuth se crea como usuario **CLIENT** |
| Sin contraseña local | Esas cuentas no usan contraseña del sistema; entran con Google/Microsoft |
| Configuración centralizada | Las credenciales se guardan en **Admin → Configuración → OAuth** (no en archivos `.env`) |

---

## Conceptos en palabras simples

| Término | Qué significa |
|---------|-----------------|
| **OAuth** | Forma segura de decir “Google/Microsoft confirma que esta persona es quien dice ser” |
| **Client ID** | Identificador público de tu aplicación (como un usuario de app) |
| **Client Secret** | Contraseña de la aplicación. **Trátala como secreta** |
| **Redirect URI** | Dirección a la que Google/Microsoft devuelven al usuario después de autorizar. **Debe coincidir letra por letra** con la del sistema |
| **Tenant ID** (Microsoft) | Qué tipo de cuentas Microsoft aceptas (`common` = personales + empresas) |

---

## Antes de empezar — checklist rápido

- [ ] Tienes rol **Super Administrador** en el sistema
- [ ] Conoces la URL con la que acceden los usuarios (ejemplo: `https://192.168.10.126` o `https://tudominio.com`)
- [ ] En el servidor existe `ENCRYPTION_KEY` en `.env.production` (cifra los secrets guardados en base de datos)
- [ ] Existen `NEXTAUTH_SECRET` y `NEXTAUTH_URL` en el entorno (en producción local, `start-production.sh` suele configurar `NEXTAUTH_URL` automáticamente)

> **Importante:** Las credenciales de Google/Microsoft **ya no se ponen en `.env`**. Se configuran desde la interfaz web. El `.env` solo lleva secretos del servidor (cifrado, sesiones, base de datos, etc.).

---

## Resumen en 4 pasos (visión general)

```
1. Crear app en Google Cloud  ──►  copiar Client ID y Secret
2. Crear app en Azure Portal  ──►  copiar Client ID, Secret y Tenant (opcional)
3. Pegar todo en Admin → OAuth  ──►  Guardar → Activar → Probar conexión
4. Registrar las Redirect URI   ──►  en Google y Azure (botón copiar en la pantalla OAuth)
```

---

## Parte 1 — Configurar Google (Gmail)

### Paso 1.1 — Entrar a Google Cloud

1. Abre [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con una cuenta de Google (puede ser personal o corporativa)
3. Arriba, selecciona un **proyecto** o crea uno nuevo (**New Project**)

### Paso 1.2 — Pantalla de consentimiento OAuth

1. Menú ☰ → **APIs & Services** → **OAuth consent screen**
2. Tipo de usuario: **External** (permite cuentas Gmail normales)
3. Completa lo mínimo obligatorio:
   - **App name:** nombre de tu sistema (ej. *Gestión Operaciones*)
   - **User support email:** tu correo
   - **Developer contact:** tu correo
4. En **Scopes**, agrega si no están:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
5. Guarda hasta completar el asistente

> Si Google pide verificación de la app para uso público masivo, en entornos internos/pequeños suele bastar con modo “Testing” y agregar usuarios de prueba en la misma pantalla.

### Paso 1.3 — Crear credenciales OAuth

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Tipo: **Web application**
4. Nombre: el que quieras (ej. *Tickets Web*)
5. **Authorized redirect URIs** — agrega **exactamente** la URL que muestra el sistema:

   ```
   https://TU-DOMINIO-O-IP/api/auth/callback/google
   ```

   Ejemplos reales:

   | Entorno | Redirect URI |
   |---------|--------------|
   | Desarrollo local | `http://localhost:3000/api/auth/callback/google` |
   | Red local (IP) | `https://192.168.10.126/api/auth/callback/google` |
   | Producción | `https://tudominio.com/api/auth/callback/google` |

6. (Opcional) **Authorized JavaScript origins:** la URL base sin la ruta final:

   ```
   https://192.168.10.126
   ```

7. Pulsa **Create**
8. Copia y guarda en un lugar seguro:
   - **Client ID** (termina en `.apps.googleusercontent.com`)
   - **Client Secret**

---

## Parte 2 — Configurar Microsoft (Outlook / Hotmail)

### Paso 2.1 — Registrar la aplicación

1. Abre [Azure Portal](https://portal.azure.com/)
2. Busca **Microsoft Entra ID** (antes “Azure Active Directory”)
3. **App registrations** → **New registration**
4. Completa:
   - **Name:** nombre de tu sistema
   - **Supported account types:**  
     *Accounts in any organizational directory and personal Microsoft accounts*  
     (recomendado: Outlook, Hotmail y cuentas de empresa)
   - **Redirect URI:** plataforma **Web**, URL:

     ```
     https://TU-DOMINIO-O-IP/api/auth/callback/azure-ad
     ```

5. **Register**

### Paso 2.2 — Más Redirect URIs (si tienes varios entornos)

1. En tu app → **Authentication**
2. En **Web** → **Redirect URIs**, agrega cada entorno que uses (local, IP, dominio)
3. Guarda

### Paso 2.3 — Crear Client Secret

1. **Certificates & secrets** → **New client secret**
2. Descripción: ej. *OAuth Tickets*
3. Expiración: 12 o 24 meses (anota la fecha en tu calendario)
4. **Add**
5. **Copia el Value inmediatamente** — Microsoft no lo vuelve a mostrar

### Paso 2.4 — Permisos de API (delegados)

1. **API permissions** → **Add a permission**
2. **Microsoft Graph** → **Delegated permissions**
3. Agrega:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
4. **Add permissions**
5. Si eres admin del tenant, puedes pulsar **Grant admin consent**

### Paso 2.5 — Anotar IDs

En **Overview** de la app, copia:

| Campo en Azure | Para qué sirve en el sistema |
|----------------|------------------------------|
| **Application (client) ID** | Client ID en Admin → OAuth |
| **Directory (tenant) ID** | Solo si quieres restringir a tu empresa; si no, usa `common` |

**Valores típicos de Tenant ID en el sistema:**

| Valor | Cuándo usarlo |
|-------|---------------|
| `common` | Gmail corporativo + Outlook/Hotmail personales (**recomendado**) |
| `organizations` | Solo cuentas de empresas |
| `consumers` | Solo cuentas personales Microsoft |
| *(tu tenant GUID)* | Solo usuarios de tu organización |

---

## Parte 3 — Configurar en el sistema (Admin UI)

Solo usuarios **Super Administrador** ven la pestaña OAuth.

### Dónde entrar

1. Inicia sesión como Super Admin
2. Ve a **Configuración del Sistema** (o `/admin/settings`)
3. Pestaña **OAuth**

Verás dos bloques: **Google OAuth** y **Microsoft OAuth**.

### Para Google

1. En **Redirect URI**, pulsa el icono **copiar** — esa misma URL debe estar en Google Cloud (Parte 1)
2. Pega el **Client ID**
3. Pega el **Client Secret**
4. Pulsa **Guardar Configuración de Google**
5. Activa el interruptor **Habilitar Google OAuth**
6. Guarda de nuevo si hace falta
7. Pulsa **Probar conexión** — debe decir que las credenciales son correctas

### Para Microsoft

1. Copia la **Redirect URI** de Microsoft
2. Pega **Client ID**, **Client Secret** y **Tenant ID** (`common` si no estás seguro)
3. **Guardar Configuración de Microsoft**
4. Activa **Habilitar Microsoft OAuth**
5. **Probar conexión**

### Estados que verás

| Badge | Significado |
|-------|-------------|
| **Activo** | Proveedor habilitado; el botón aparece en login/registro |
| **Inactivo** | Credenciales guardadas pero el interruptor está apagado |

> **No hace falta reiniciar Docker** después de guardar. El sistema recarga la configuración en menos de 1 minuto. Si acabas de activar un proveedor y no ves el botón, espera unos segundos y recarga la página de login.

### Red local (IP tipo `192.168.x.x`)

Si accedes por IP interna, verás un aviso amarillo en la pestaña OAuth. Significa:

- Debes registrar la URL **HTTPS completa** en Google y Azure
- Google exige HTTPS; con certificado autofirmado el navegador puede pedir “aceptar riesgo” **antes** del login OAuth
- La Redirect URI debe ser **idéntica** (mismo protocolo, IP, sin barra final extra)

---

## Parte 4 — Qué sigue en `.env` (solo servidor)

Estas variables **no** sustituyen la configuración OAuth de la UI. Son requisitos del servidor:

```env
# Obligatorias para OAuth en producción
ENCRYPTION_KEY="clave-larga-generada-con-openssl"
NEXTAUTH_SECRET="otra-clave-segura"
NEXTAUTH_URL="https://192.168.10.126"

# Base de datos (ejemplo)
DATABASE_URL="postgresql://..."
```

Generar claves (en Linux):

```bash
openssl rand -base64 32
```

| Variable | ¿Para qué? |
|----------|------------|
| `ENCRYPTION_KEY` | Cifra los Client Secret guardados en base de datos |
| `NEXTAUTH_SECRET` | Firma las sesiones de usuario |
| `NEXTAUTH_URL` | URL base del sistema; define las Redirect URI correctas |

> **Ya no necesitas** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AZURE_AD_*` en `.env` si configuraste todo desde Admin → OAuth.

---

## Parte 5 — Probar que todo funciona

### Prueba 1 — Admin

- [ ] **Probar conexión** OK para Google
- [ ] **Probar conexión** OK para Microsoft (si lo usas)
- [ ] Badge **Activo** en el proveedor que quieres usar

### Prueba 2 — Login

1. Abre `/login` en ventana privada
2. Debes ver **Google** y/o **Microsoft** (solo los activos)
3. Pulsa el botón → te lleva a Google/Microsoft
4. Autoriza → vuelves al sistema y entras al panel

### Prueba 3 — Registro nuevo

1. Abre `/register` con una cuenta que **nunca** haya entrado al sistema
2. Entra con OAuth
3. El usuario nuevo debe tener rol **CLIENT** y acceso al área de cliente

### Prueba 4 — Usuario que ya existía

Si el email ya estaba registrado con contraseña:

- Puede vincular OAuth al mismo email (se actualiza avatar y último login)
- **No** se cambia su rol automáticamente

---

## Cómo lo ven los usuarios finales

### Registro (`/register`)

1. Opción A: formulario clásico (nombre, email, contraseña, departamento)
2. Opción B: botón **Google** o **Microsoft** → registro en un clic

### Login (`/login`)

1. Email + contraseña, **o**
2. Botón Google / Microsoft

### Si algo falla

El sistema muestra mensajes claros en español, por ejemplo:

| Mensaje | Qué hacer |
|---------|-----------|
| *OAuth no está configurado correctamente* | Revisa Admin → OAuth, **Probar conexión**, y Redirect URI en el portal |
| *Acceso denegado* | La cuenta puede estar desactivada; contacta al administrador |
| *Redirect URI mismatch* (en Google/Microsoft) | Copia de nuevo la URI desde Admin → OAuth y pégala en el portal |

---

## Problemas frecuentes y soluciones

### “Redirect URI mismatch”

**Causa:** La URL en Google/Azure no coincide con la del sistema.

**Solución:**

1. Admin → OAuth → copiar Redirect URI
2. Pegar **exactamente** en el portal (incluye `https://`, la IP o dominio, y la ruta completa)
3. Rutas correctas:
   - Google: `/api/auth/callback/google`
   - Microsoft: `/api/auth/callback/azure-ad`

### “Configuration” o “No se pudo conectar con Google/Microsoft”

**Causa:** Proveedor inactivo, secret incorrecto o `ENCRYPTION_KEY` ausente.

**Solución:**

1. Verifica que el interruptor esté **Activo**
2. Vuelve a pegar el Client Secret y guarda
3. Usa **Probar conexión**
4. Confirma `ENCRYPTION_KEY` en `.env.production`

### Los botones no aparecen en login

**Causa:** Proveedor desactivado o credenciales incompletas.

**Solución:**

1. Admin → OAuth → estado **Activo**
2. Client ID + Secret guardados
3. Recarga `/login`

### “Access denied” / Acceso denegado

**Causa:** Usuario desactivado en el sistema o registro OAuth rechazado.

**Solución:** Un administrador debe activar la cuenta en **Usuarios**.

### Microsoft: secret expirado

Los secrets de Azure **caducan**. Antes de la fecha:

1. Crea un secret nuevo en Azure
2. Pégalo en Admin → OAuth → Microsoft → Guardar
3. **Probar conexión**
4. Elimina el secret viejo en Azure

### Google: app en modo “Testing”

Solo los usuarios agregados como “Test users” en OAuth consent screen pueden entrar. Para producción real, publica la app o amplía usuarios de prueba.

---

## Seguridad — qué guarda el sistema

| Sí guarda | No guarda |
|-----------|-----------|
| Email, nombre, avatar (URL) | Contraseña de Google/Microsoft |
| ID del proveedor (para vincular cuenta) | Tokens de acceso en texto plano |
| Client Secret **cifrado** en BD | Client Secret en `.env` (flujo normal) |

- Solo **Super Admin** puede editar OAuth
- Usuarios OAuth nuevos → rol **CLIENT** únicamente
- Cuentas desactivadas no pueden entrar

---

## Checklist final de implementación

### En Google Cloud

- [ ] Proyecto creado
- [ ] OAuth consent screen configurado
- [ ] OAuth client ID (Web) creado
- [ ] Redirect URI registrada

### En Azure Portal

- [ ] App registration creada
- [ ] Redirect URI registrada
- [ ] Client secret creado y copiado
- [ ] Permisos Graph delegados (`openid`, `profile`, `email`, `User.Read`)

### En el sistema

- [ ] `ENCRYPTION_KEY` y `NEXTAUTH_SECRET` en entorno
- [ ] `NEXTAUTH_URL` correcta
- [ ] Admin → OAuth → credenciales guardadas
- [ ] Proveedor **Activo**
- [ ] **Probar conexión** exitoso
- [ ] Login OAuth probado
- [ ] Registro OAuth probado (usuario CLIENT)

---

## Glosario rápido

| Sigla / palabra | Explicación breve |
|-----------------|-------------------|
| **Super Admin** | Administrador con acceso total, incluida pestaña OAuth |
| **CLIENT** | Rol de usuario final que crea tickets |
| **Callback** | URL donde el proveedor devuelve al usuario tras autorizar |
| **Portal** | Google Cloud Console o Azure Portal (donde creas la app externa) |

---

## Más ayuda

- Checklist de despliegue: `REBUILD.md` (sección OAuth)
- Documentación NextAuth: [authjs.dev](https://authjs.dev/)
- Google OAuth: [developers.google.com/identity](https://developers.google.com/identity/protocols/oauth2)
- Microsoft: [Entra ID app registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)

---

**¿Listo?** Si completaste el checklist y **Probar conexión** funciona, tus usuarios ya pueden entrar con Gmail o Microsoft desde `/login` y `/register`.
