import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type JwtPayload } from './jwt.guard';
import { CurrentUser } from './current-user.decorator';

class AuthDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

const AUTH_COOKIE = 'auth_token';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false, // set true behind HTTPS in production
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto.email, dto.password);
    res.cookie(AUTH_COOKIE, result.accessToken, cookieOptions);
    return result; // { accessToken, user }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    res.cookie(AUTH_COOKIE, result.accessToken, cookieOptions);
    return result; // { accessToken, user }
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  // Protected: the JwtAuthGuard verifies the token (Bearer or cookie) and sets req.user.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
