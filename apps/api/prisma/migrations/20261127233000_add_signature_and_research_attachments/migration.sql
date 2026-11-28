-- SDR-010: optional reusable email-account signature and research-owned
-- initial-email attachments. Additive only: every column is nullable, one new
-- table is created and no existing row, column or index is altered.

-- AlterTable
ALTER TABLE "email_accounts"
  ADD COLUMN "signatureName" TEXT,
  ADD COLUMN "signatureCompany" TEXT,
  ADD COLUMN "signaturePhone" TEXT,
  ADD COLUMN "signatureWebsite" TEXT,
  ADD COLUMN "signatureWhatsapp" TEXT,
  ADD COLUMN "signatureText" TEXT;

-- CreateTable
CREATE TABLE "research_attachments" (
  "id" TEXT NOT NULL,
  "researchId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "research_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_attachments_researchId_createdAt_idx" ON "research_attachments"("researchId", "createdAt");

-- AddForeignKey
ALTER TABLE "research_attachments"
  ADD CONSTRAINT "research_attachments_researchId_fkey"
  FOREIGN KEY ("researchId") REFERENCES "researches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
