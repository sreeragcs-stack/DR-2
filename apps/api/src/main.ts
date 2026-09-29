import { config } from 'dotenv';
config({ path: '../../.env' }); // monorepo-root .env (cwd is apps/api)

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser()); // so JwtAuthGuard can read the auth_token cookie
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (process.env.NODE_ENV !== 'production') {
    // Swagger in dev only: UI at /api/docs, schema at /api/docs-json. Mount path MUST stay under
    // /api — the preview proxy only forwards /api/* to this server; /docs would hit the web app → 404.
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('API').build());
    SwaggerModule.setup('api/docs', app, doc);
  }
  await app.listen(Number(process.env.PORT) || 3001, '0.0.0.0');
}
bootstrap();
