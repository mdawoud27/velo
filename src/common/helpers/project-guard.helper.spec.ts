import { HttpStatus } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { assertProjectWritable } from './project-guard.helper';

import { ResourceNotFoundException } from '../exceptions';

function makePrisma(projectResult: { status: ProjectStatus } | null) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue(projectResult),
    },
  } as any;
}

describe('assertProjectWritable', () => {
  it('resolves without throwing for an ACTIVE project', async () => {
    const prisma = makePrisma({ status: ProjectStatus.ACTIVE });
    await expect(assertProjectWritable(prisma, 'proj-1')).resolves.toBeUndefined();
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'proj-1', deletedAt: null },
      select: { status: true },
    });
  });

  it('throws ResourceNotFoundException when project is not found', async () => {
    const prisma = makePrisma(null);
    await expect(assertProjectWritable(prisma, 'missing-id')).rejects.toThrow(
      ResourceNotFoundException,
    );
  });

  it('throws a 403 DomainException for an ARCHIVED project', async () => {
    const prisma = makePrisma({ status: ProjectStatus.ARCHIVED });
    let thrownError: any;

    try {
      await assertProjectWritable(prisma, 'archived-proj');
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.getStatus()).toBe(HttpStatus.FORBIDDEN);

    const body = thrownError.getResponse() as Record<string, any>;
    expect(body.error.code).toBe('PROJECT_ARCHIVED');
    expect(body.error.message).toContain('archived');
  });

  it('queries only non-deleted projects (deletedAt: null)', async () => {
    const prisma = makePrisma({ status: ProjectStatus.ACTIVE });
    await assertProjectWritable(prisma, 'proj-abc');

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});
