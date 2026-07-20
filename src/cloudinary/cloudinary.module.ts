import { BadRequestException, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: () => ({
        storage: memoryStorage(),
        limits: { fieldSize: 10 * 1024 * 1024 },
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
    }),
  ],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
