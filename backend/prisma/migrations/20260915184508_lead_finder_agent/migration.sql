-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('EXCELLENT', 'STRONG', 'POTENTIAL', 'LOW');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'RESEARCHED';
ALTER TYPE "LeadStatus" ADD VALUE 'EMAIL_DRAFTED';
ALTER TYPE "LeadStatus" ADD VALUE 'REPLIED';
ALTER TYPE "LeadStatus" ADD VALUE 'NOT_INTERESTED';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "emailBody" TEXT,
ADD COLUMN     "emailSubject" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "gmailDraftId" TEXT,
ADD COLUMN     "opportunityTypes" "OpportunityType"[],
ADD COLUMN     "priority" "LeadPriority",
ADD COLUMN     "sourceUrl" TEXT;

-- CreateIndex
CREATE INDEX "leads_priority_idx" ON "leads"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "leads_domain_key" ON "leads"("domain");

