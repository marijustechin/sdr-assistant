-- Additive migration: independent SMTP/IMAP connection-verification results.
-- It creates one enum and adds six nullable/defaulted columns to
-- "email_accounts". No research table is referenced or altered, and existing
-- rows default to NOT_TESTED.

CREATE TYPE "EmailVerificationStatus" AS ENUM ('NOT_TESTED', 'VERIFIED', 'FAILED');

ALTER TABLE "email_accounts"
    ADD COLUMN "smtpVerificationStatus" "EmailVerificationStatus" NOT NULL DEFAULT 'NOT_TESTED',
    ADD COLUMN "smtpLastCheckedAt" TIMESTAMP(3),
    ADD COLUMN "smtpVerificationFailureCode" TEXT,
    ADD COLUMN "imapVerificationStatus" "EmailVerificationStatus" NOT NULL DEFAULT 'NOT_TESTED',
    ADD COLUMN "imapLastCheckedAt" TIMESTAMP(3),
    ADD COLUMN "imapVerificationFailureCode" TEXT;
