-- Performance indexes for tickets table
-- These indexes improve query performance for the most common filter patterns

CREATE INDEX IF NOT EXISTS "tickets_status_createdAt_idx"
  ON "tickets" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "tickets_clientId_status_idx"
  ON "tickets" ("clientId", "status");

CREATE INDEX IF NOT EXISTS "tickets_priority_idx"
  ON "tickets" ("priority");

CREATE INDEX IF NOT EXISTS "tickets_updatedAt_idx"
  ON "tickets" ("updatedAt" DESC);
