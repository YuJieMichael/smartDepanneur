/*
  Warnings:

  - The values [viewed] on the enum `ApplicationState` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationState_new" AS ENUM ('applied', 'rejected', 'reviewed');
ALTER TABLE "applications" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "applications" ALTER COLUMN "state" TYPE "ApplicationState_new" USING ("state"::text::"ApplicationState_new");
ALTER TYPE "ApplicationState" RENAME TO "ApplicationState_old";
ALTER TYPE "ApplicationState_new" RENAME TO "ApplicationState";
DROP TYPE "ApplicationState_old";
ALTER TABLE "applications" ALTER COLUMN "state" SET DEFAULT 'applied';
COMMIT;
