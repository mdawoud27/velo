import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { VALID_QUEUE_NAMES } from '../constants';

export type ValidQueueName = (typeof VALID_QUEUE_NAMES)[number];

@Injectable()
export class QueueNamePipe implements PipeTransform {
  transform(value: string): ValidQueueName {
    if (!VALID_QUEUE_NAMES.includes(value as ValidQueueName)) {
      throw new BadRequestException(
        `Invalid queue name '${value}'. Valid queues: ${VALID_QUEUE_NAMES.join(', ')}`,
      );
    }
    return value as ValidQueueName;
  }
}
