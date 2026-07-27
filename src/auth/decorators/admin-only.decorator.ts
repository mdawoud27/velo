import { applyDecorators, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';

export const AdminOnly = () => applyDecorators(UseGuards(AdminGuard));
