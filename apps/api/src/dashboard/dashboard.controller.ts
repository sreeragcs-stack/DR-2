import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.guard';
import { ClassificationService } from './classification.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly classification: ClassificationService,
  ) {}

  @Get('falcon')
  falcon() {
    return this.service.falcon();
  }

  @Post('falcon/refresh')
  refresh() {
    return this.service.refreshScan();
  }

  @Post('falcon/classification-runs')
  async classify(@CurrentUser() user: JwtPayload, @Res() response: Response) {
    response.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const send = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const result = await this.classification.run(user, (progress) => {
        send('progress', progress);
      }, (started) => {
        send('started', started);
      });
      send('completed', result);
    } catch (error) {
      send('failed', { message: error instanceof Error ? error.message : 'Classification could not be completed. Try again.' });
    } finally {
      response.end();
    }
  }

  @Get('falcon/classification-runs/:runId')
  getClassification(@Param('runId') runId: string) {
    return this.classification.get(runId);
  }
}
