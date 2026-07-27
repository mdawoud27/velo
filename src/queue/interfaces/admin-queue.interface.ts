import { EmailJobData } from './email-data.interface';
import { ExportJobData } from './export-data.interface';

export type AdminQueueJobData = EmailJobData | ExportJobData;
