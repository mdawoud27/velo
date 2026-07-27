import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { EMAIL_QUEUE, EXPORT_QUEUE } from 'src/queue/constants';

const VALID_QUEUE_NAMES = [EMAIL_QUEUE, EXPORT_QUEUE] as const;
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
