/*
  Warnings:

  - You are about to drop the column `address` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `custom_fields` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `nickname` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `postcode` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `resume` on the `job_post_templates` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `job_post_templates` table. All the data in the column will be lost.
  - Added the required column `template_name` to the `job_post_templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dictionaries" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "job_post_templates" DROP COLUMN "address",
DROP COLUMN "country",
DROP COLUMN "custom_fields",
DROP COLUMN "email",
DROP COLUMN "nickname",
DROP COLUMN "phone",
DROP COLUMN "postcode",
DROP COLUMN "resume",
DROP COLUMN "state",
ADD COLUMN     "fields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "template_name" TEXT NOT NULL;
