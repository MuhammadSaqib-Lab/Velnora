-- CreateEnum
CREATE TYPE "AgentKey" AS ENUM ('CUSTOMER_HANDLER', 'LEAD_FINDER');


-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "agentKey" "AgentKey" NOT NULL,
    "displayName" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_config_versions" (
    "id" TEXT NOT NULL,
    "agentConfigId" TEXT NOT NULL,
    "agentKey" "AgentKey" NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "changeType" TEXT NOT NULL,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_agentKey_key" ON "agent_configs"("agentKey");

-- CreateIndex
CREATE INDEX "agent_config_versions_agentConfigId_idx" ON "agent_config_versions"("agentConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_config_versions_agentKey_version_key" ON "agent_config_versions"("agentKey", "version");

-- AddForeignKey
ALTER TABLE "agent_config_versions" ADD CONSTRAINT "agent_config_versions_agentConfigId_fkey" FOREIGN KEY ("agentConfigId") REFERENCES "agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

