-- AlterTable
ALTER TABLE "research_stage_03_results" ADD COLUMN     "criteria" JSONB,
ADD COLUMN     "decidedPages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "decisions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "errorPages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promptVersion" TEXT,
ALTER COLUMN "result" DROP NOT NULL;

-- AlterTable
ALTER TABLE "researches" ADD COLUMN     "executionLeaseUntil" TIMESTAMP(3),
ADD COLUMN     "executionToken" TEXT;
