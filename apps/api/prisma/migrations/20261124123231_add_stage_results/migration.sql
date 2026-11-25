-- CreateTable
CREATE TABLE "research_stage_01_results" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_stage_01_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_stage_02_results" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_stage_02_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_stage_03_results" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_stage_03_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_stage_01_results_jobId_key" ON "research_stage_01_results"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "research_stage_02_results_jobId_key" ON "research_stage_02_results"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "research_stage_03_results_jobId_key" ON "research_stage_03_results"("jobId");

-- AddForeignKey
ALTER TABLE "research_stage_01_results" ADD CONSTRAINT "research_stage_01_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "researches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_stage_02_results" ADD CONSTRAINT "research_stage_02_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "researches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_stage_03_results" ADD CONSTRAINT "research_stage_03_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "researches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
