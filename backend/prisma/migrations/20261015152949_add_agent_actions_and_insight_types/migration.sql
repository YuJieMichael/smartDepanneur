-- CreateEnum
CREATE TYPE "AgentActionType" AS ENUM ('generate_purchase_orders', 'set_min_stock');

-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('pending', 'approved', 'rejected', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InsightType" ADD VALUE 'expiry_risks';
ALTER TYPE "InsightType" ADD VALUE 'min_stock_review';
ALTER TYPE "InsightType" ADD VALUE 'agent_action';

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" SERIAL NOT NULL,
    "type" "AgentActionType" NOT NULL,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'pending',
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "requested_by_id" INTEGER,
    "decided_by_id" INTEGER,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_actions_status_created_at_idx" ON "agent_actions"("status", "created_at");

-- CreateIndex
CREATE INDEX "agent_actions_dedupe_key_status_idx" ON "agent_actions"("dedupe_key", "status");

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
