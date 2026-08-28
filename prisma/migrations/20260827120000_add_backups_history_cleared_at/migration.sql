-- Al borrar una entrada del "Historial de operaciones" de Backups, solo se
-- eliminaban las filas de audit_logs que la respaldaban. El backup en sí
-- seguía existiendo en `backups`, así que en la siguiente carga volvía a
-- aparecer reconstruida como registro "legacy" (sin auditoría) — y esa
-- reconstrucción no es eliminable, dando la sensación de que el borrado no
-- funcionó. Esta columna marca ese backup como "historial ocultado" para que
-- ya no se reconstruya, sin tocar el backup ni su archivo real.
ALTER TABLE "backups"
  ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3);
