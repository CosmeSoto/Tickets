-- Cierra la creación de comparticiones duplicadas para el mismo
-- (entry_id, user_id): antes el POST de compartir solo comprobaba con un
-- SELECT previo (findFirst) sin garantía atómica, y un doble clic o un
-- reintento de red podía crear dos filas. El DELETE de revocación ya se
-- corrigió para borrar todas las coincidentes (deleteMany), pero esto evita
-- que el duplicado se cree en primer lugar.
CREATE UNIQUE INDEX IF NOT EXISTS "credential_shares_entry_id_user_id_key" ON "credential_shares"("entry_id", "user_id");
