/*
  Warnings:

  - You are about to drop the column `status` on the `applications` table. All the data in the column will be lost.
  - The `reviewer` column on the `job_posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ApplicationState" AS ENUM ('applied', 'rejected');

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "status",
ADD COLUMN     "state" "ApplicationState" NOT NULL DEFAULT 'applied';

-- AlterTable
ALTER TABLE "job_posts" DROP COLUMN "reviewer",
ADD COLUMN     "reviewer" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropEnum
DROP TYPE "ApplicationStatus";
