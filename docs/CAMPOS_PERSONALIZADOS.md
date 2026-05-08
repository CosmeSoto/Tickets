# Campos Personalizados de Inventario

## 📋 Descripción

Los campos personalizados permiten definir atributos específicos para cada familia de inventario (Tecnología, Activos Fijos, Seguridad, Mantenimiento, etc.). Estos campos aparecen automáticamente en el formulario de creación/edición de equipos según la familia del tipo de equipo seleccionado.

## 🎯 Características

- **Por familia**: Cada familia de inventario puede tener sus propios campos personalizados
- **Tipos de datos**: Texto, número, selección, fecha, booleano
- **Validación**: Campos obligatorios y opcionales
- **Persistencia**: Los valores se guardan en la base de datos junto con el equipo
- **Interfaz dinámica**: Los campos aparecen automáticamente en el formulario según el tipo de equipo

## 🚀 Uso

### 1. Configurar Campos Personalizados

1. Ir a **Admin → Configuración → Inventario**
2. Hacer clic en el botón **"Campos Personalizados"** en el header
3. Seleccionar la familia de inventario
4. Agregar, editar o eliminar campos personalizados

### 2. Tipos de Campos Disponibles

#### Texto

- Para valores alfanuméricos
- Ejemplos: marca, modelo, número de serie, IP, MAC
- Opciones: longitud máxima

#### Número

- Para valores numéricos
- Ejemplos: capacidad (GB), voltaje (V), potencia (W), RAM (GB)
- Opciones: valor mínimo, valor máximo

#### Selección

- Para elegir entre opciones predefinidas
- Ejemplos: tipo de disco (SSD/HDD), sistema operativo (Windows/Linux/macOS)
- Opciones: lista de valores permitidos

#### Fecha

- Para fechas específicas
- Ejemplos: última revisión, próxima revisión, fecha de garantía
- Formato: selector de calendario

#### Booleano

- Para valores sí/no
- Ejemplos: visión nocturna, certificación, garantía activa
- Formato: switch on/off

### 3. Crear/Editar Equipos con Campos Personalizados

1. Ir a **Inventario → Equipos → Nuevo Equipo**
2. Seleccionar el **Tipo de Equipo**
3. Los campos personalizados de la familia aparecerán automáticamente en la sección **"Atributos Personalizados"**
4. Completar los campos requeridos (marcados con \*)
5. Guardar el equipo

## 📊 Ejemplos de Campos por Familia

### Tecnología (TEC)

- **Procesador** (texto): Intel Core i7-12700K
- **RAM** (número): 16 GB
- **Almacenamiento** (número): 512 GB
- **Tipo de Disco** (selección): SSD / HDD
- **Sistema Operativo** (selección): Windows 11 / Ubuntu 22.04 / macOS Ventura
- **Tarjeta Gráfica** (texto): NVIDIA RTX 3060
- **Resolución** (texto): 1920x1080
- **IP** (texto): 192.168.1.100
- **MAC** (texto): 00:1B:44:11:3A:B7

### Activos Fijos (ACT)

- **Fabricante** (texto): Caterpillar
- **Año de Fabricación** (número): 2023
- **Capacidad** (número): 5000 kg
- **Voltaje** (número): 220 V
- **Potencia** (número): 1500 W
- **Área de Uso** (texto): Producción
- **Estado de Conservación** (selección): Excelente / Bueno / Regular / Malo
- **Certificaciones** (texto): ISO 9001, CE

### Seguridad (SEG)

- **Resolución** (texto): 4K (3840x2160)
- **Tipo de Lente** (selección): Fijo / Varifocal / PTZ
- **Visión Nocturna** (booleano): Sí / No
- **Nivel de Seguridad** (selección): Básico / Medio / Alto
- **Zona de Cobertura** (texto): Entrada principal
- **Certificación IP** (texto): IP67

### Mantenimiento (MAN)

- **Frecuencia de Mantenimiento** (selección): Mensual / Trimestral / Semestral / Anual
- **Última Revisión** (fecha): 2024-01-15
- **Próxima Revisión** (fecha): 2024-04-15
- **Tipo de Mantenimiento** (selección): Preventivo / Correctivo

## 🔧 Implementación Técnica

### Base de Datos

Los campos personalizados se almacenan en dos tablas:

1. **`family_custom_fields`**: Define los campos disponibles para cada familia
   - `id`: UUID
   - `familyId`: Referencia a la familia
   - `fieldName`: Nombre interno del campo (snake_case)
   - `fieldLabel`: Etiqueta visible para el usuario
   - `fieldType`: Tipo de dato (text, number, select, date, boolean)
   - `fieldOptions`: Opciones adicionales (JSON)
   - `isRequired`: Si el campo es obligatorio
   - `helpText`: Texto de ayuda

2. **`equipment.customValues`**: Almacena los valores de los campos para cada equipo
   - Formato: `[{ fieldName: "procesador", fieldValue: "Intel Core i7" }]`
   - Tipo: JSON array

### API Endpoints

- **GET** `/api/inventory/families/{familyId}/custom-fields`: Obtiene los campos de una familia
- **POST** `/api/inventory/families/{familyId}/custom-fields`: Crea un nuevo campo
- **PUT** `/api/inventory/families/{familyId}/custom-fields/{fieldId}`: Actualiza un campo
- **DELETE** `/api/inventory/families/{familyId}/custom-fields/{fieldId}`: Elimina un campo

### Componentes

- **`CustomFieldsInput`**: Renderiza los campos personalizados en el formulario de equipos
- **`CustomFieldsManager`**: Interfaz de administración de campos personalizados
- **`CustomFieldForm`**: Formulario para crear/editar campos personalizados

## 📝 Seed de Datos

El sistema incluye un seed con 39 campos personalizados predefinidos:

```bash
npx prisma db seed
```

Esto creará campos para las 4 familias principales:

- **Tecnología**: 14 campos (procesador, RAM, almacenamiento, etc.)
- **Activos Fijos**: 11 campos (fabricante, año, capacidad, etc.)
- **Seguridad**: 10 campos (resolución, tipo de lente, visión nocturna, etc.)
- **Mantenimiento**: 4 campos (frecuencia, última revisión, etc.)

## 🎨 Mejores Prácticas

1. **Nombres descriptivos**: Usa nombres claros y concisos para los campos
2. **Ayuda contextual**: Agrega texto de ayuda para campos complejos
3. **Validación**: Marca como obligatorios solo los campos realmente necesarios
4. **Opciones limitadas**: En campos de selección, limita las opciones a lo esencial
5. **Consistencia**: Usa el mismo formato para campos similares en diferentes familias

## 🐛 Troubleshooting

### Los campos no aparecen en el formulario

- Verifica que el tipo de equipo seleccionado pertenezca a una familia con campos personalizados
- Revisa que los campos estén activos en la configuración

### Los valores no se guardan

- Verifica que el campo `customValues` esté incluido en el payload del formulario
- Revisa los logs del servidor para errores de validación

### Error al cargar campos

- Verifica que la familia tenga campos configurados
- Revisa la conexión a la base de datos

## 📚 Referencias

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React Hook Form](https://react-hook-form.com/)
