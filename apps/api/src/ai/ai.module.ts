import { Module } from '@nestjs/common';
import { AiService } from './ai.service';

/**
 * Injected by the platform when an app is built with AI features. Register it in app.module.ts:
 *
 *   import { AiModule } from './ai/ai.module';
 *   @Module({ imports: [DbModule, AuthModule, AiModule], ... })
 *
 * Self-contained on purpose: no database, no auth dependency, nothing from the rest of the app. That
 * is what lets it be dropped into any fullstack workspace and removed again without leaving a trace.
 */
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
