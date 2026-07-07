-- CreateTable
CREATE TABLE "dictionaries" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT[],

    CONSTRAINT "dictionaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dictionaries_key_key" ON "dictionaries"("key");
