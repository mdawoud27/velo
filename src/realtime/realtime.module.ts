import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { JwtModule } from '@nestjs/jwt';
import { jwtModuleAsyncOptions } from 'src/auth/jwt.config';

@Module({
  imports: [JwtModule.registerAsync(jwtModuleAsyncOptions)],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
