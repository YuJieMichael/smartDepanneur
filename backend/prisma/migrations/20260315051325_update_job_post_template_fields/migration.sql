/*
  Warnings:

  - You are about to drop the column `job_description` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `skill_requirements` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `job_post_templates` table. All the data in the column will be lost.
  - Added the required column `email` to the `job_post_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nickname` to the `job_post_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `job_post_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resume` to the `job_post_templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "job_post_templates" DROP COLUMN "job_description",
DROP COLUMN "skill_requirements",
DROP COLUMN "title",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "nickname" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "resume" TEXT NOT NULL;
