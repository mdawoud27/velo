/*
  Warnings:

  - Added the required column `invitedById` to the `OrgInvitation` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Organization_name_key";

-- AlterTable
ALTER TABLE "OrgInvitation" ADD COLUMN     "invitedById" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OrgInvitation_email_idx" ON "OrgInvitation"("email");

-- AddForeignKey
ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
