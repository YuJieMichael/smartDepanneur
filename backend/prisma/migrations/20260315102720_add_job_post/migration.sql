-- CreateTable
CREATE TABLE "job_posts" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "job_posts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
