import { Attachment } from '@prisma/client';

export class AttachmentEntity {
  id: string;
  filename: string;
  url: string;
  size: number;
  taskId: string;
  uploaderId: string;
  createdAt: Date;

  constructor(attachment: Attachment) {
    this.id = attachment.id;
    this.filename = attachment.filename;
    this.url = attachment.url;
    this.size = attachment.size;
    this.taskId = attachment.taskId;
    this.uploaderId = attachment.uploaderId;
    this.createdAt = attachment.createdAt;
  }
}

export class AttachmentUploadResultDto {
  succeeded: AttachmentEntity[];
  failed: { filename: string; reason: string }[];
}
