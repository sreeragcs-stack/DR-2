import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from './jwt.guard';

// `@CurrentUser()` — the JWT payload of the authenticated user (only on routes guarded by
// `@UseGuards(JwtAuthGuard)`). Example: `me(@CurrentUser() user: JwtPayload) { ... }`.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>().user,
);
