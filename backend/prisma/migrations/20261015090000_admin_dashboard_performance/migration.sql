-- The admin overview lists the 5 newest leads (ORDER BY "createdAt" DESC LIMIT 5, twice);
-- without this index each of those reads and sorts the whole table.
-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");
