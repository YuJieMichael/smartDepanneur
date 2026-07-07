/*
  Warnings:

  - Added the required column `user_id` to the `job_post_templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "job_post_templates" ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "job_post_templates" ADD CONSTRAINT "job_post_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
