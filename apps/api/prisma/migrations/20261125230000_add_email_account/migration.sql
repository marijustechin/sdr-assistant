-- CreateEnum
CREATE TYPE "EmailSecurityMode" AS ENUM ('TLS', 'STARTTLS');

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpSecurity" "EmailSecurityMode" NOT NULL,
    "smtpUsername" TEXT NOT NULL,
    "smtpPasswordEncrypted" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL,
    "imapSecurity" "EmailSecurityMode" NOT NULL,
    "imapUsername" TEXT NOT NULL,
    "imapPasswordEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);
