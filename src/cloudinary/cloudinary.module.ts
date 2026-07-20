import { BadRequestException, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const cloudinaryMulterModule = MulterModule.registerAsync({
  useFactory: () => ({
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type ${file.mimetype} not allowed`), false);
      }
    },
  }),
});

@Module({
  imports: [cloudinaryMulterModule],
  providers: [CloudinaryService],
  exports: [CloudinaryService, cloudinaryMulterModule],
})
export class CloudinaryModule {}
