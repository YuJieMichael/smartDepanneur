-- AlterEnum
ALTER TYPE "ApplicationState" ADD VALUE 'reviewed';

-- AlterTable
ALTER TABLE "job_posts" ADD COLUMN     "collector" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
