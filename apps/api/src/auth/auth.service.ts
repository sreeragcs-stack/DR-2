import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DB, type Db } from '../db/db.module';
import { users } from '../db/schema';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string) {
    const [existing] = await this.db.select().from(users).where(eq(users.email, email));
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await this.db.insert(users).values({ email, passwordHash }).returning();
    return this.session(user);
  }

  async login(email: string, password: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.session(user);
  }

  // The current user — call from a guarded route with the JWT payload's `sub`.
  async me(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  // Token (for `Authorization: Bearer`) + safe user (also set as the `auth_token` cookie by the
  // controller). Add fields to the payload here (e.g. `role`) and to JwtPayload in jwt.guard.ts.
  private session(user: typeof users.$inferSelect) {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { accessToken, user: this.sanitize(user) };
  }

  // Never return the password hash. Extend with your own user columns.
  private sanitize(user: typeof users.$inferSelect) {
    return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
  }
}
