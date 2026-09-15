-- AlterTable
ALTER TABLE "categories" ADD COLUMN "priority_ceiling" "TicketPriority";

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "requested_priority" "TicketPriority";
