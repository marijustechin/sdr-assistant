/*
  Warnings:

  - You are about to drop the column `result` on the `research_stage_01_results` table. All the data in the column will be lost.
  - Added the required column `identifiedProduct` to the `research_stage_01_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preparedCandidates` to the `research_stage_01_results` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "research_stage_01_results" DROP COLUMN "result",
ADD COLUMN     "identifiedProduct" JSONB NOT NULL,
ADD COLUMN     "preparedCandidates" JSONB NOT NULL;
