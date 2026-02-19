# Scripts Históricos (Archivados)

Esta carpeta contiene **105 scripts** de prueba, corrección y verificación que ya no son necesarios para el día a día del proyecto, pero se mantienen para referencia histórica.

## Contenido

### Scripts de Prueba (test-*.sh, test-*.js)
Scripts para probar funcionalidades específicas:
- APIs de categorías, conocimientos, tickets
- Autenticación y autorización
- Notificaciones y persistencia
- Búsqueda y filtros
- Módulos de técnicos y usuarios
- Y muchos más...

### Scripts de Corrección (fix-*.sh, fix-*.js)
Scripts para aplicar correcciones automáticas:
- Relaciones de Prisma
- Referencias de API
- Redundancias de código
- Errores de runtime
- Problemas de seed
- Y muchos más...

### Scripts de Verificación (verificar-*.sh, verificar-*.js, verify-*.sh, verify-*.ts)
Scripts para verificar que las correcciones funcionan:
- Correcciones aplicadas
- Datos reales en BD
- Optimizaciones
- Mejoras visuales
- Consistencia de UX
- Y muchos más...

### Scripts de Diagnóstico (diagnosticar-*.js, diagnose-*.js)
Scripts para diagnosticar problemas:
- Problemas de autenticación
- Errores de API
- Problemas de búsqueda
- Y más...

### Scripts de Integración (integrate-*.js)
Scripts para integrar sistemas:
- Sistema de auditoría
- Y más...

### Scripts de Validación (validate-*.js)
Scripts para validar módulos completos.

### Scripts de Utilidad
- `apply-ux-fixes.sh` - Aplicar correcciones de UX
- `consolidar-documentacion.sh` - Consolidar documentación
- `corregir-auth.sh` - Corregir autenticación
- `start-system.sh` - Iniciar sistema
- Y más...

## ¿Por qué están archivados?

Estos scripts fueron útiles durante el desarrollo activo, pero ahora:
- ✅ Las pruebas ya pasaron
- ✅ Las correcciones ya están aplicadas
- ✅ Las verificaciones ya están completadas
- ✅ Los problemas ya están resueltos
- ✅ El sistema está estable

## Scripts Activos

Para scripts de desarrollo actuales, consulta:
- **package.json** - Scripts de npm (dev, build, test, etc.)
- **prisma/** - Scripts de migración de BD
- **scripts/** - Scripts de utilidad activos (si existen)

## Nota Importante

Estos scripts están archivados, NO eliminados. Si necesitas referencia de cómo se solucionó un problema específico, puedes consultar estos scripts.

---

**Archivado:** 2026-02-19  
**Total de scripts:** 105
