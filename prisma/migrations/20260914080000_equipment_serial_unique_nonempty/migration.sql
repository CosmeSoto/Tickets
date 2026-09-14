-- serialNumber es requerido pero puede quedar en '' para equipos sin número
-- de serie real; un @unique plano rompería esos casos. Índice único parcial:
-- solo exige unicidad cuando el número de serie no está vacío.
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_serial_number_key"
  ON "equipment"("serial_number")
  WHERE "serial_number" <> '';
