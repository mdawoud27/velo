import { HttpStatus } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DomainException, ResourceNotFoundException } from '../exceptions';

export async function assertProjectWritable(
  prisma: PrismaService,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { status: true },
  });

  if (!project) {
    throw new ResourceNotFoundException('Project', projectId);
  }

  if (project.status === ProjectStatus.ARCHIVED) {
    throw new DomainException(
      HttpStatus.FORBIDDEN,
      'PROJECT_ARCHIVED',
      'This project is archived and read-only. Restore it to make changes.',
    );
  }
}
