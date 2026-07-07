-- CreateTable
CREATE TABLE "job_post_templates" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "skill_requirements" TEXT[],
    "custom_fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_post_templates_pkey" PRIMARY KEY ("id")
);
