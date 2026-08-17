-- Distinguir escaneos de pases pendientes de aceptación de privacidad.
ALTER TYPE "AccessScanResult" ADD VALUE IF NOT EXISTS 'PENDING_PRIVACY';
