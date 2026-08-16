import { BadRequestException } from '@nestjs/common';
import { QueueNamePipe } from './queue-name.pipe';
import { VALID_QUEUE_NAMES } from '../constants';

describe('QueueNamePipe', () => {
  let pipe: QueueNamePipe;

  beforeEach(() => {
    pipe = new QueueNamePipe();
  });

  it('passes through a valid queue name', () => {
    VALID_QUEUE_NAMES.forEach((name) => {
      expect(pipe.transform(name)).toBe(name);
    });
  });

  it('throws BadRequestException for an invalid queue name', () => {
    expect(() => pipe.transform('invalid-queue-name')).toThrow(BadRequestException);
    expect(() => pipe.transform('invalid-queue-name')).toThrow(/Invalid queue name/);
  });
});
