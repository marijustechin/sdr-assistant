-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'INTERRUPTED');

-- CreateTable
CREATE TABLE "researches" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" "ResearchStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT,
    "result" JSONB,
    "error" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "researches_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "researches" ADD CONSTRAINT "researches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
