-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('NEW_REQUEST', 'REVIEWING', 'APPROVED', 'IN_PROGRESS', 'CLIENT_REVIEW', 'REVISION', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "client_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "client_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "projectSeq" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "targetAudience" TEXT,
    "requiredFeatures" TEXT,
    "budgetRange" TEXT,
    "timeline" TEXT,
    "additionalNotes" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'NEW_REQUEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_history" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "oldStatus" "ProjectStatus",
    "newStatus" "ProjectStatus" NOT NULL,
    "message" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_sessions_tokenHash_key" ON "client_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "client_sessions_userId_idx" ON "client_sessions"("userId");

-- CreateIndex
CREATE INDEX "client_sessions_expiresAt_idx" ON "client_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectSeq_key" ON "projects"("projectSeq");

-- CreateIndex
CREATE INDEX "projects_clientId_createdAt_idx" ON "projects"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");

-- CreateIndex
CREATE INDEX "project_status_history_projectId_createdAt_idx" ON "project_status_history"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "client_sessions" ADD CONSTRAINT "client_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

