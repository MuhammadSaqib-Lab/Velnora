-- CreateEnum
CREATE TYPE "MarketingTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingLabel" AS ENUM ('VERIFIED', 'RECOMMENDATION', 'ESTIMATE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "AgentKey" ADD VALUE 'DIGITAL_MARKETING';

-- CreateTable
CREATE TABLE "marketing_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "MarketingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL DEFAULT '{}',
    "configVersion" INTEGER,
    "idempotencyKey" TEXT,
    "resultType" TEXT,
    "resultIds" JSONB NOT NULL DEFAULT '[]',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryOfId" TEXT,
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_audits" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "domain" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OWN',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_audit_findings" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" "FindingLabel" NOT NULL,
    "result" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" JSONB,
    "pageUrl" TEXT,
    "impact" INTEGER,
    "effort" INTEGER,
    "confidence" TEXT,

    CONSTRAINT "seo_audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_content_drafts" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "contentType" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[],
    "callToAction" TEXT,
    "notes" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "plannedFor" TIMESTAMP(3),
    "campaignId" TEXT,
    "sourceDraftId" TEXT,
    "generatedByTaskId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'AI',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_draft_revisions" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[],
    "source" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_draft_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_strategies" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STRATEGY',
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "items" JSONB NOT NULL DEFAULT '[]',
    "kpis" JSONB NOT NULL DEFAULT '[]',
    "status" "StrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" TEXT NOT NULL DEFAULT 'AI',
    "generatedByTaskId" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT,
    "market" TEXT,
    "service" TEXT,
    "channel" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetAmount" INTEGER,
    "budgetCurrency" TEXT,
    "activities" JSONB NOT NULL DEFAULT '[]',
    "successMetrics" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "results" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actor" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_tasks_idempotencyKey_key" ON "marketing_tasks"("idempotencyKey");

-- CreateIndex
CREATE INDEX "marketing_tasks_createdAt_idx" ON "marketing_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "marketing_tasks_type_status_idx" ON "marketing_tasks"("type", "status");

-- CreateIndex
CREATE INDEX "seo_audits_domain_createdAt_idx" ON "seo_audits"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "seo_audits_createdAt_idx" ON "seo_audits"("createdAt");

-- CreateIndex
CREATE INDEX "seo_audit_findings_auditId_idx" ON "seo_audit_findings"("auditId");

-- CreateIndex
CREATE INDEX "seo_audit_findings_checkKey_idx" ON "seo_audit_findings"("checkKey");

-- CreateIndex
CREATE INDEX "social_content_drafts_status_idx" ON "social_content_drafts"("status");

-- CreateIndex
CREATE INDEX "social_content_drafts_plannedFor_idx" ON "social_content_drafts"("plannedFor");

-- CreateIndex
CREATE INDEX "social_content_drafts_platform_createdAt_idx" ON "social_content_drafts"("platform", "createdAt");

-- CreateIndex
CREATE INDEX "social_content_drafts_campaignId_idx" ON "social_content_drafts"("campaignId");

-- CreateIndex
CREATE INDEX "social_draft_revisions_draftId_createdAt_idx" ON "social_draft_revisions"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "marketing_strategies_kind_status_idx" ON "marketing_strategies"("kind", "status");

-- CreateIndex
CREATE INDEX "marketing_strategies_createdAt_idx" ON "marketing_strategies"("createdAt");

-- CreateIndex
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns"("status");

-- CreateIndex
CREATE INDEX "marketing_campaigns_createdAt_idx" ON "marketing_campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "marketing_audit_logs_createdAt_idx" ON "marketing_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "marketing_audit_logs_entityType_entityId_idx" ON "marketing_audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "seo_audit_findings" ADD CONSTRAINT "seo_audit_findings_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "seo_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_content_drafts" ADD CONSTRAINT "social_content_drafts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_draft_revisions" ADD CONSTRAINT "social_draft_revisions_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "social_content_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

