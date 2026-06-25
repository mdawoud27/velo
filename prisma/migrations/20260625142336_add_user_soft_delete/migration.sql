-- DropIndex
DROP INDEX "User_bannedAt_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_bannedAt_deletedAt_idx" ON "User"("bannedAt", "deletedAt");
