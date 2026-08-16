import { TaskStatus } from '@prisma/client';
import { VALID_TRANSITIONS } from './task-transitions';

describe('VALID_TRANSITIONS', () => {
  it('defines transitions for every TaskStatus value', () => {
    const allStatuses = Object.values(TaskStatus);
    allStatuses.forEach((status) => {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    });
  });

  describe('TODO', () => {
    it('can only move to IN_PROGRESS', () => {
      expect(VALID_TRANSITIONS[TaskStatus.TODO]).toEqual([TaskStatus.IN_PROGRESS]);
    });

    it('cannot move directly to IN_REVIEW', () => {
      expect(VALID_TRANSITIONS[TaskStatus.TODO]).not.toContain(TaskStatus.IN_REVIEW);
    });

    it('cannot move directly to DONE', () => {
      expect(VALID_TRANSITIONS[TaskStatus.TODO]).not.toContain(TaskStatus.DONE);
    });
  });

  describe('IN_PROGRESS', () => {
    it('can move to IN_REVIEW', () => {
      expect(VALID_TRANSITIONS[TaskStatus.IN_PROGRESS]).toContain(TaskStatus.IN_REVIEW);
    });

    it('can move back to TODO', () => {
      expect(VALID_TRANSITIONS[TaskStatus.IN_PROGRESS]).toContain(TaskStatus.TODO);
    });

    it('cannot move directly to DONE', () => {
      expect(VALID_TRANSITIONS[TaskStatus.IN_PROGRESS]).not.toContain(TaskStatus.DONE);
    });
  });

  describe('IN_REVIEW', () => {
    it('can move to DONE', () => {
      expect(VALID_TRANSITIONS[TaskStatus.IN_REVIEW]).toContain(TaskStatus.DONE);
    });

    it('can be sent back to IN_PROGRESS', () => {
      expect(VALID_TRANSITIONS[TaskStatus.IN_REVIEW]).toContain(TaskStatus.IN_PROGRESS);
    });

    it('cannot move back to TODO', () => {
      expect(VALID_TRANSITIONS[TaskStatus.IN_REVIEW]).not.toContain(TaskStatus.TODO);
    });
  });

  describe('DONE', () => {
    it('can only be reopened to IN_PROGRESS', () => {
      expect(VALID_TRANSITIONS[TaskStatus.DONE]).toEqual([TaskStatus.IN_PROGRESS]);
    });

    it('cannot move to TODO', () => {
      expect(VALID_TRANSITIONS[TaskStatus.DONE]).not.toContain(TaskStatus.TODO);
    });

    it('cannot remain DONE (no self-transition)', () => {
      expect(VALID_TRANSITIONS[TaskStatus.DONE]).not.toContain(TaskStatus.DONE);
    });
  });
});
