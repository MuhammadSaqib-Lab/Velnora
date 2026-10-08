-- CreateEnum
CREATE TYPE "LeadSearchStatus" AS ENUM ('RUNNING', 'COMPLETED', 'NEEDS_CLARIFICATION', 'FAILED');

-- CreateTable
CREATE TABLE "lead_search_requests" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "parsedCriteria" JSONB,
    "parseMethod" TEXT,
    "status" "LeadSearchStatus" NOT NULL DEFAULT 'RUNNING',
    "foundCount" INTEGER,
    "resultCount" INTEGER,
    "errorCode" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_search_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_search_requests_createdAt_idx" ON "lead_search_requests"("createdAt");

-- CreateIndex
CREATE INDEX "lead_search_requests_status_idx" ON "lead_search_requests"("status");

