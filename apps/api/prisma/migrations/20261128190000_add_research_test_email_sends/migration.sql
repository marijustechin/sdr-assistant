-- SDR-010: recorded test-email attempts. Additive only: one enum, one new
-- table, its index and its foreign key. No existing column, row or table is
-- altered. Test sends are stored separately from first-contact communication.

-- CreateEnum
CREATE TYPE "TestEmailSendStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "research_test_email_sends" (
  "id" TEXT NOT NULL,
  "researchId" TEXT NOT NULL,
  "emailAccountId" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "attachmentCount" INTEGER NOT NULL DEFAULT 0,
  "status" "TestEmailSendStatus" NOT NULL,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "research_test_email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_test_email_sends_researchId_createdAt_idx" ON "research_test_email_sends"("researchId", "createdAt");

-- AddForeignKey
ALTER TABLE "research_test_email_sends"
  ADD CONSTRAINT "research_test_email_sends_researchId_fkey"
  FOREIGN KEY ("researchId") REFERENCES "researches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
