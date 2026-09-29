import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { RequirementsModule } from './requirements/requirements.module';
import { DriftsModule } from './drifts/drifts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [DbModule, AuthModule, RequirementsModule, DriftsModule, DashboardModule, AiModule],
  controllers: [HealthController],
})
export class AppModule {}
