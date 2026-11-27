-- Additive Stage 05 persistence. This migration creates two independent
-- qualification tables and does not alter any research or stage table. It is
-- not applied by the implementation proof.

CREATE TYPE "LeadQualificationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'INTERRUPTED', 'FAILED');
CREATE TYPE "LeadQualificationTrigger" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "LeadQualificationDecision" AS ENUM ('ACCEPTED', 'EXCLUDED');

CREATE TABLE "lead_qualification_runs" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "status" "LeadQualificationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "LeadQualificationTrigger" NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "qualificationVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "inputFingerprint" TEXT NOT NULL,
    "sourceResultSchemaVersion" INTEGER,
    "companyCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "technicalFailureCount" INTEGER NOT NULL DEFAULT 0,
    "usage" JSONB NOT NULL DEFAULT '{}',
    "executionToken" TEXT,
    "executionLeaseUntil" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "error" TEXT,
    "startKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_qualification_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_qualification_results" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceCompanyIndex" INTEGER NOT NULL,
    "sourceCompanyKey" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "companyName" TEXT,
    "legalName" TEXT,
    "country" TEXT,
    "profileHash" TEXT NOT NULL,
    "decision" "LeadQualificationDecision" NOT NULL,
    "primaryExclusionReason" TEXT,
    "exclusionReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "technicalFailure" BOOLEAN NOT NULL DEFAULT false,
    "checks" JSONB NOT NULL,
    "contacts" JSONB NOT NULL,
    "evidenceSources" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_qualification_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_qualification_runs_researchId_startKey_key"
    ON "lead_qualification_runs"("researchId", "startKey");
CREATE INDEX "lead_qualification_runs_researchId_createdAt_idx"
    ON "lead_qualification_runs"("researchId", "createdAt");
CREATE INDEX "lead_qualification_runs_status_executionLeaseUntil_idx"
    ON "lead_qualification_runs"("status", "executionLeaseUntil");
CREATE UNIQUE INDEX "lead_qualification_one_active_run_per_research"
    ON "lead_qualification_runs"("researchId")
    WHERE "status" IN ('QUEUED', 'RUNNING');
CREATE UNIQUE INDEX "lead_qualification_one_published_run_per_research"
    ON "lead_qualification_runs"("researchId")
    WHERE "publishedAt" IS NOT NULL;

CREATE UNIQUE INDEX "lead_qualification_results_runId_sourceCompanyIndex_key"
    ON "lead_qualification_results"("runId", "sourceCompanyIndex");
CREATE INDEX "lead_qualification_results_runId_decision_idx"
    ON "lead_qualification_results"("runId", "decision");
CREATE INDEX "lead_qualification_results_runId_primaryExclusionReason_idx"
    ON "lead_qualification_results"("runId", "primaryExclusionReason");

ALTER TABLE "lead_qualification_runs"
    ADD CONSTRAINT "lead_qualification_runs_researchId_fkey"
    FOREIGN KEY ("researchId") REFERENCES "researches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_qualification_results"
    ADD CONSTRAINT "lead_qualification_results_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "lead_qualification_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
