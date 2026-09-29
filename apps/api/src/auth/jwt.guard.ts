import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type JwtPayload = { sub: string; email: string; role: 'pm' | 'admin' };

// Reads the JWT from the `Authorization: Bearer` header OR the `auth_token` cookie, verifies it,
// and sets `req.user`. Protect routes with `@UseGuards(JwtAuthGuard)`. Add fields to JwtPayload and
// to the token in AuthService (e.g. a `role`) if you need them.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; cookies?: Record<string, string> }>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Not authenticated');
    try {
      req.user = this.jwt.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(
    req: Request & { cookies?: Record<string, string> },
  ): string | undefined {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return req.cookies?.auth_token;
  }
}
