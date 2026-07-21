import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRateLimitGuard } from './guards';

@Module({
  controllers: [AiController],
  providers: [AiService, AiRateLimitGuard],
})
export class AiModule {}
