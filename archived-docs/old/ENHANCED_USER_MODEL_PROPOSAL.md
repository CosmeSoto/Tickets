# Propuesta: Modelo de Usuario Profesional Mejorado

## Problema Actual
El modelo actual de User es básico y no incluye campos importantes para un sistema profesional de gestión de usuarios, especialmente para autoregistro OAuth.

## Campos Adicionales Propuestos

### 1. Información Personal Completa
```prisma
model User {
  // Campos existentes...
  id                    String                  @id @default(cuid())
  email                 String                  @unique
  name                  String
  
  // 🆕 NUEVOS CAMPOS PROFESIONALES
  firstName             String?                 // Nombre(s)
  lastName              String?                 // Apellido(s)
  middleName            String?                 // Segundo nombre
  displayName           String?                 // Nombre para mostrar (ej: "Juan P.")
  
  // Información personal
  dateOfBirth           DateTime?               // Fecha de nacimiento
  gender                Gender?                 // Género
  nationality           String?                 // Nacionalidad
  
  // Información de contacto extendida
  phone                 String?                 // Teléfono principal
  alternativePhone      String?                 // Teléfono alternativo
  address               String?                 // Dirección completa
  city                  String?                 // Ciudad
  state                 String?                 // Estado/Provincia
  country               String?                 // País
  postalCode            String?                 // Código postal
  
  // Información profesional
  jobTitle              String?                 // Cargo/Puesto
  employeeId            String?                 // ID de empleado
  hireDate              DateTime?               // Fecha de contratación
  manager               String?                 // ID del supervisor
  workLocation          String?                 // Ubicación de trabajo
  
  // Configuración de cuenta
  timezone              String                  @default("America/Mexico_City")
  language              String                  @default("es")
  theme                 String                  @default("system")
  
  // Campos de seguridad mejorados
  lastPasswordChange    DateTime?               // Última vez que cambió contraseña
  passwordExpiresAt     DateTime?               // Expiración de contraseña
  failedLoginAttempts   Int                     @default(0)
  lockedUntil           DateTime?               // Cuenta bloqueada hasta
  
  // Campos OAuth mejorados
  oauthProvider         String?                 // 'google', 'microsoft', etc.
  oauthId               String?                 // ID del proveedor OAuth
  oauthPicture          String?                 // URL de foto de OAuth
  oauthVerified         Boolean                 @default(false)
  
  // Metadatos de registro
  registrationSource    RegistrationSource      @default(MANUAL)
  registrationIp        String?                 // IP de registro
  emailVerificationToken String?               // Token de verificación
  emailVerifiedAt       DateTime?               // Cuándo se verificó el email
  
  // Campos de auditoría mejorados
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  lastLoginAt           DateTime?               // Último login exitoso
  lastLoginIp           String?                 // IP del último login
  lastActivityAt        DateTime?               // Última actividad
  
  // Campos existentes...
  passwordHash          String?
  role                  UserRole                @default(CLIENT)
  departmentId          String?
  avatar                String?
  isActive              Boolean                 @default(true)
  isEmailVerified       Boolean                 @default(false)
  
  // Relaciones existentes...
  department            Department?             @relation(fields: [departmentId], references: [id])
  // ... otras relaciones
  
  @@index([firstName, lastName])
  @@index([employeeId])
  @@index([registrationSource])
  @@index([oauthProvider, oauthId])
  @@map("users")
}

// 🆕 NUEVOS ENUMS
enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum RegistrationSource {
  MANUAL          // Creado manualmente por admin
  SELF_REGISTER   // Autoregistro web
  GOOGLE_OAUTH    // Registro via Google
  MICROSOFT_OAUTH // Registro via Microsoft/Outlook
  BULK_IMPORT     // Importación masiva
  API             // Creado via API
}
```

## Beneficios del Modelo Mejorado

### 1. 🔐 Seguridad Avanzada
- Control de intentos de login fallidos
- Bloqueo temporal de cuentas
- Expiración de contraseñas
- Auditoría completa de accesos

### 2. 👤 Gestión Profesional de Usuarios
- Información personal completa
- Datos profesionales (cargo, empleado ID)
- Jerarquía organizacional (manager)
- Ubicación de trabajo

### 3. 🌐 OAuth Mejorado
- Soporte para múltiples proveedores
- Sincronización de fotos de perfil
- Verificación OAuth
- Trazabilidad de origen de registro

### 4. 📊 Reportes y Analytics
- Fuente de registros
- Patrones de actividad
- Demografía de usuarios
- Métricas de seguridad

## Migración Gradual Propuesta

### Fase 1: Campos Básicos (Semana 1)
```sql
-- Agregar campos de nombre mejorados
ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN last_name VARCHAR(255);
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);

-- Migrar datos existentes
UPDATE users SET 
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE 
    WHEN array_length(string_to_array(name, ' '), 1) > 1 
    THEN array_to_string(string_to_array(name, ' ')[2:], ' ')
    ELSE NULL 
  END,
  display_name = name;
```

### Fase 2: Información Personal (Semana 2)
```sql
-- Campos de información personal
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN gender VARCHAR(20);
ALTER TABLE users ADD COLUMN job_title VARCHAR(255);
ALTER TABLE users ADD COLUMN employee_id VARCHAR(100);
```

### Fase 3: OAuth Mejorado (Semana 3)
```sql
-- Campos OAuth mejorados
ALTER TABLE users ADD COLUMN oauth_picture VARCHAR(500);
ALTER TABLE users ADD COLUMN oauth_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN registration_source VARCHAR(50) DEFAULT 'MANUAL';
```

### Fase 4: Seguridad Avanzada (Semana 4)
```sql
-- Campos de seguridad
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP;
```

## Formularios de Registro OAuth

### Google OAuth Registration
```tsx
interface GoogleUserData {
  email: string
  name: string
  given_name: string      // firstName
  family_name: string     // lastName
  picture: string         // oauthPicture
  locale: string          // language
  verified_email: boolean // emailVerified
}
```

### Microsoft OAuth Registration
```tsx
interface MicrosoftUserData {
  mail: string
  displayName: string
  givenName: string       // firstName
  surname: string         // lastName
  jobTitle?: string       // jobTitle
  mobilePhone?: string    // phone
  businessPhones?: string[] // alternativePhone
  preferredLanguage: string // language
}
```

## Formulario de Perfil Completo

```tsx
// Componente de perfil mejorado
<ProfileForm>
  <PersonalInfoSection>
    <Input name="firstName" label="Nombre(s)" />
    <Input name="lastName" label="Apellido(s)" />
    <DatePicker name="dateOfBirth" label="Fecha de Nacimiento" />
    <Select name="gender" label="Género" />
  </PersonalInfoSection>
  
  <ContactInfoSection>
    <Input name="phone" label="Teléfono Principal" />
    <Input name="alternativePhone" label="Teléfono Alternativo" />
    <TextArea name="address" label="Dirección" />
    <Input name="city" label="Ciudad" />
  </ContactInfoSection>
  
  <ProfessionalInfoSection>
    <Input name="jobTitle" label="Cargo/Puesto" />
    <Input name="employeeId" label="ID de Empleado" />
    <DatePicker name="hireDate" label="Fecha de Contratación" />
    <Select name="workLocation" label="Ubicación de Trabajo" />
  </ProfessionalInfoSection>
  
  <OAuthAccountsSection>
    <ConnectedAccounts />
    <LinkAccountButtons />
  </OAuthAccountsSection>
</ProfileForm>
```

## Validaciones y Reglas de Negocio

### 1. Campos Obligatorios por Fuente
```typescript
const requiredFields = {
  MANUAL: ['email', 'firstName', 'lastName'],
  GOOGLE_OAUTH: ['email', 'firstName'], // lastName opcional
  MICROSOFT_OAUTH: ['email', 'displayName'],
  BULK_IMPORT: ['email', 'firstName', 'lastName', 'employeeId']
}
```

### 2. Validaciones de Seguridad
```typescript
const securityRules = {
  maxFailedAttempts: 5,
  lockoutDuration: 30, // minutos
  passwordExpiry: 90, // días
  minPasswordAge: 1 // día
}
```

## Impacto en Componentes Existentes

### UserStatsCard Mejorado
```tsx
// Mostrar información más rica
<UserStatsCard>
  <UserAvatar src={user.oauthPicture || user.avatar} />
  <UserName>{user.displayName || user.name}</UserName>
  <JobTitle>{user.jobTitle}</JobTitle>
  <RegistrationBadge source={user.registrationSource} />
</UserStatsCard>
```

### Filtros Avanzados
```tsx
<UserFilters>
  <Select name="registrationSource" />
  <Select name="department" />
  <Select name="jobTitle" />
  <DateRange name="hireDate" />
</UserFilters>
```

## Timeline de Implementación

| Semana | Tarea | Entregables |
|--------|-------|-------------|
| 1 | Migración Fase 1 + UI básica | Campos de nombre, formularios |
| 2 | Información personal | Perfil completo, validaciones |
| 3 | OAuth mejorado | Registro automático, sync datos |
| 4 | Seguridad avanzada | Bloqueos, auditoría |
| 5 | Testing y refinamiento | Pruebas, documentación |

## Consideraciones Importantes

1. **Retrocompatibilidad**: Todos los campos nuevos son opcionales
2. **Migración de Datos**: Scripts para migrar usuarios existentes
3. **Performance**: Índices apropiados para búsquedas
4. **Privacidad**: Cumplimiento con GDPR/LOPD
5. **Seguridad**: Encriptación de datos sensibles

Este modelo profesional permitirá un sistema de gestión de usuarios robusto y escalable, preparado para OAuth y con todas las características de un sistema empresarial moderno.