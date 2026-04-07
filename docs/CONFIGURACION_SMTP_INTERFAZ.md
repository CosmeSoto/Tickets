# 📧 Configuración SMTP desde la Interfaz

## ✅ Respuesta Rápida

**SÍ, puedes configurar el SMTP desde la interfaz web sin necesidad de variables de entorno.**

El sistema ya está preparado para cargar la configuración SMTP desde la base de datos (tabla `system_settings`). La interfaz de administración que mencionas es la forma correcta de configurarlo.

## 🎯 Cómo Funciona

### Prioridad de Configuración

El sistema busca la configuración en este orden:

1. **Base de Datos** (tabla `system_settings`) ← **RECOMENDADO**
2. Variables de entorno (fallback)
3. Configuración por defecto (solo para desarrollo)

### Código Actual

En `src/lib/email-service.ts`:

```typescript
async function getEmailConfig(): Promise<EmailConfig> {
  try {
    // 1. Intenta cargar desde la base de datos
    const settings = await prisma.system_settings.findMany({
      where: {
        key: {
          in: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 
               'smtpSecure', 'emailFrom', 'emailEnabled']
        }
      }
    })

    const config: any = { ...DEFAULT_EMAIL_CONFIG }

    settings.forEach(setting => {
      switch (setting.key) {
        case 'smtpHost':
          config.host = setting.value || DEFAULT_EMAIL_CONFIG.host
          break
        case 'smtpPort':
          config.port = parseInt(setting.value) || DEFAULT_EMAIL_CONFIG.port
          break
        // ... más configuraciones
      }
    })

    return config
  } catch (error) {
    console.error('Error loading email config:', error)
    return DEFAULT_EMAIL_CONFIG
  }
}
```

## 🖥️ Configuración desde la Interfaz

### Ubicación

La interfaz de configuración debería estar en:
- **Ruta:** `/admin/settings` o `/admin/email-settings`
- **Sección:** "Configuración de Email"

### Campos a Configurar

1. **Habilitar envío de emails** (checkbox)
2. **Servidor SMTP** (ej: `smtp.gmail.com`)
3. **Puerto SMTP** (ej: `587` para TLS, `465` para SSL)
4. **Usuario SMTP** (tu email)
5. **Contraseña SMTP** (contraseña de aplicación)
6. **Email Remitente** (ej: `Sistema de Tickets <soporte@tuempresa.com>`)
7. **Conexión Segura (SSL/TLS)** (checkbox)
8. **Botón: Probar Conexión**

### Valores que se Guardan en la BD

Los valores se guardan en la tabla `system_settings` con estas claves:

| Key | Ejemplo de Valor | Descripción |
|-----|------------------|-------------|
| `emailEnabled` | `"true"` | Habilita/deshabilita el envío |
| `smtpHost` | `"smtp.gmail.com"` | Servidor SMTP |
| `smtpPort` | `"587"` | Puerto SMTP |
| `smtpUser` | `"tu-email@gmail.com"` | Usuario SMTP |
| `smtpPassword` | `"tu-contraseña-app"` | Contraseña SMTP |
| `emailFrom` | `"Soporte <internet.freecom@gmail.com>"` | Email remitente |
| `smtpSecure` | `"false"` | SSL/TLS (false para 587, true para 465) |

## 📝 Ejemplo de Configuración para Gmail

### Paso 1: Crear Contraseña de Aplicación

1. Ve a tu cuenta de Google
2. Seguridad → Verificación en 2 pasos (debe estar activada)
3. Contraseñas de aplicaciones
4. Genera una nueva contraseña para "Correo"
5. Copia la contraseña generada (16 caracteres)

### Paso 2: Configurar en la Interfaz

```
Habilitar envío de emails: ✓
Servidor SMTP: smtp.gmail.com
Puerto SMTP: 587
Usuario SMTP: tu-email@gmail.com
Contraseña SMTP: [contraseña de 16 caracteres]
Email Remitente: Sistema de Tickets <tu-email@gmail.com>
Conexión Segura: ☐ (desactivado para puerto 587)
```

### Paso 3: Probar Conexión

Haz clic en "Probar Conexión" para verificar que todo funciona.

## 🔧 Otros Proveedores SMTP

### SendGrid

```
Servidor SMTP: smtp.sendgrid.net
Puerto SMTP: 587
Usuario SMTP: apikey
Contraseña SMTP: [tu API key de SendGrid]
Conexión Segura: ☐
```

### Mailgun

```
Servidor SMTP: smtp.mailgun.org
Puerto SMTP: 587
Usuario SMTP: postmaster@tu-dominio.mailgun.org
Contraseña SMTP: [tu contraseña de Mailgun]
Conexión Segura: ☐
```

### AWS SES

```
Servidor SMTP: email-smtp.us-east-1.amazonaws.com
Puerto SMTP: 587
Usuario SMTP: [tu SMTP username de AWS]
Contraseña SMTP: [tu SMTP password de AWS]
Conexión Segura: ☐
```

### Outlook/Office 365

```
Servidor SMTP: smtp.office365.com
Puerto SMTP: 587
Usuario SMTP: tu-email@outlook.com
Contraseña SMTP: [tu contraseña]
Conexión Segura: ☐
```

## 🚀 Cómo Hacer las Pruebas

### 1. Configurar desde la Interfaz

1. Ve a la sección de configuración de email
2. Completa todos los campos
3. Haz clic en "Guardar"

### 2. Probar la Conexión

El botón "Probar Conexión" ejecuta:

```typescript
// En tu API de configuración
const transporter = nodemailer.createTransporter({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPassword
  }
})

await transporter.verify()
```

### 3. Crear un Ticket de Prueba

1. Como cliente, crea un nuevo ticket
2. Verifica que lleguen los emails:
   - Email al cliente (confirmación)
   - Email al administrador (notificación)

### 4. Asignar un Técnico

1. Como admin, asigna el ticket a un técnico
2. Verifica que lleguen los emails:
   - Email al técnico (asignación)
   - Email al cliente (técnico asignado)

## 🐛 Solución de Problemas

### Error: "Authentication failed"

**Causa:** Credenciales incorrectas

**Solución:**
- Verifica usuario y contraseña
- Para Gmail, usa contraseña de aplicación (no tu contraseña normal)
- Verifica que la verificación en 2 pasos esté activada (Gmail)

### Error: "Connection timeout"

**Causa:** Puerto o servidor incorrecto

**Solución:**
- Verifica el servidor SMTP
- Prueba puerto 587 (TLS) o 465 (SSL)
- Verifica que tu firewall no bloquee el puerto

### Error: "Self signed certificate"

**Causa:** Problema con certificados SSL

**Solución:**
- Usa puerto 587 con `smtpSecure: false`
- O puerto 465 con `smtpSecure: true`

### Los emails no llegan

**Verifica:**
1. ✅ `emailEnabled` está en `"true"`
2. ✅ La configuración está guardada en la BD
3. ✅ Los logs no muestran errores
4. ✅ Revisa la carpeta de spam
5. ✅ Verifica que el email remitente sea válido

## 📊 Verificar Configuración Actual

Puedes verificar qué configuración está usando el sistema:

```sql
-- En tu base de datos
SELECT * FROM system_settings 
WHERE key LIKE 'smtp%' OR key LIKE 'email%';
```

Deberías ver algo como:

```
| key           | value                    |
|---------------|--------------------------|
| emailEnabled  | true                     |
| smtpHost      | smtp.gmail.com           |
| smtpPort      | 587                      |
| smtpUser      | tu-email@gmail.com       |
| smtpPassword  | [encriptado]             |
| emailFrom     | Soporte <...>            |
| smtpSecure    | false                    |
```

## 🔒 Seguridad

### Contraseñas Encriptadas

**Recomendación:** Las contraseñas SMTP deberían estar encriptadas en la base de datos.

Si quieres implementar encriptación:

```typescript
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY // 32 bytes
const IV_LENGTH = 16

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encrypted = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
```

## ✅ Resumen

1. **NO necesitas variables de entorno** - La configuración desde la interfaz es suficiente
2. **La configuración se guarda en la BD** - Tabla `system_settings`
3. **El sistema ya está preparado** - Solo necesitas usar la interfaz
4. **Puedes hacer pruebas inmediatamente** - Configura y prueba

## 🎯 Próximos Pasos

1. Ve a la interfaz de configuración de email
2. Completa los campos con tus credenciales SMTP
3. Haz clic en "Probar Conexión"
4. Si funciona, guarda la configuración
5. Crea un ticket de prueba para verificar los emails

¡El sistema está listo para enviar emails! 🚀
