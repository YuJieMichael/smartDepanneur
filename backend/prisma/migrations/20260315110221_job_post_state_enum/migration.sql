/*
  Warnings:

  - The `state` column on the `job_posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "JobPostState" AS ENUM ('active', 'closed');

-- AlterTable
ALTER TABLE "job_posts" DROP COLUMN "state",
ADD COLUMN     "state" "JobPostState" NOT NULL DEFAULT 'active';
