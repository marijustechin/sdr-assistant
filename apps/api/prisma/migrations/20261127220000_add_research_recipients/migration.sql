-- Additive SDR-009 persistence. It adds three nullable columns to the existing
-- research communication settings table and one new prepared-recipient table.
-- It does not alter, delete or rewrite an existing research, stage, product,
-- setting, email-account or Stage 05 row. This migration is not applied by the
-- implementation proof and requires separate human authorization to deploy.

ALTER TABLE "research_communication_settings"
    ADD COLUMN "initialEmailSubject" TEXT,
    ADD COLUMN "initialEmailBody" TEXT,
    ADD COLUMN "recipientQueueSourceRunId" TEXT;

CREATE TYPE "RecipientSelectionReason" AS ENUM ('SALES_DEPARTMENT', 'GENERAL_MAILBOX', 'INDIVIDUAL_CONTACT');
CREATE TYPE "RecipientQueueStatus" AS ENUM ('PREPARED');

CREATE TABLE "research_recipients" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "sourceRunId" TEXT NOT NULL,
    "sourceResultId" TEXT NOT NULL,
    "sourceCompanyIndex" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "companyName" TEXT,
    "primaryEmail" TEXT NOT NULL,
    "alternativeEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "selectionReason" "RecipientSelectionReason" NOT NULL,
    "status" "RecipientQueueStatus" NOT NULL DEFAULT 'PREPARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "research_recipients_researchId_domain_key"
    ON "research_recipients"("researchId", "domain");
CREATE UNIQUE INDEX "research_recipients_researchId_primaryEmail_key"
    ON "research_recipients"("researchId", "primaryEmail");
CREATE INDEX "research_recipients_researchId_status_idx"
    ON "research_recipients"("researchId", "status");

ALTER TABLE "research_recipients"
    ADD CONSTRAINT "research_recipients_researchId_fkey"
    FOREIGN KEY ("researchId") REFERENCES "researches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
