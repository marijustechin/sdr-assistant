-- AlterTable
ALTER TABLE "products" ADD COLUMN     "generalCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
