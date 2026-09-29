import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OpenProjectClient } from './openproject.client';
import { ClassificationService } from './classification.service';

@Module({
  imports: [AiModule],
  controllers: [DashboardController],
  providers: [DashboardService, OpenProjectClient, ClassificationService],
})
export class DashboardModule {}
