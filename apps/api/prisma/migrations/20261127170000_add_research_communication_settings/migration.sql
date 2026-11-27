-- Additive SDR-008 migration: research-specific communication settings with an
-- optional email-account assignment. It creates one table and two foreign keys;
-- no existing table, column or row is altered. The assignment is independent of
-- research execution, and credentials remain only in "email_accounts".
-- ON DELETE RESTRICT keeps an account that is still assigned from being deleted
-- silently; disabling an account does not touch the assignment.

CREATE TABLE "research_communication_settings" (
    "researchId" TEXT NOT NULL,
    "emailAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_communication_settings_pkey" PRIMARY KEY ("researchId")
);

CREATE INDEX "research_communication_settings_emailAccountId_idx" ON "research_communication_settings"("emailAccountId");

ALTER TABLE "research_communication_settings" ADD CONSTRAINT "research_communication_settings_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "researches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_communication_settings" ADD CONSTRAINT "research_communication_settings_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
