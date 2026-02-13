-- Migración: Corregir zona horaria a Ecuador
-- Fecha: 2026-02-13
-- Descripción: Actualizar todos los registros de America/Mexico_City a America/Guayaquil

-- Actualizar user_settings
UPDATE user_settings 
SET 
  timezone = 'America/Guayaquil',
  language = 'es',
  "updatedAt" = NOW()
WHERE timezone != 'America/Guayaquil' OR language != 'es';

-- Actualizar user_preferences
UPDATE user_preferences 
SET 
  timezone = 'America/Guayaquil',
  language = 'es',
  "updatedAt" = NOW()
WHERE timezone != 'America/Guayaquil' OR language != 'es';

-- Verificar cambios
SELECT 
  'user_settings' as tabla,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN timezone = 'America/Guayaquil' THEN 1 END) as timezone_correcto,
  COUNT(CASE WHEN language = 'es' THEN 1 END) as idioma_correcto
FROM user_settings
UNION ALL
SELECT 
  'user_preferences' as tabla,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN timezone = 'America/Guayaquil' THEN 1 END) as timezone_correcto,
  COUNT(CASE WHEN language = 'es' THEN 1 END) as idioma_correcto
FROM user_preferences;
