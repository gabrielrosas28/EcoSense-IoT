-- Adiciona a tabela de ambientes e liga dispositivos e leituras a ela.

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "environments_slug_key" ON "environments"("slug");

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "environmentId" TEXT;

-- AlterTable
ALTER TABLE "readings" ADD COLUMN     "environmentId" TEXT;

-- CreateIndex
CREATE INDEX "devices_environmentId_idx" ON "devices"("environmentId");

-- CreateIndex
CREATE INDEX "readings_environmentId_readAt_idx" ON "readings"("environmentId", "readAt");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
