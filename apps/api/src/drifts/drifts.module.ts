import { Module } from '@nestjs/common';
import { DriftsController } from './drifts.controller';
import { DriftsService } from './drifts.service';

@Module({
  controllers: [DriftsController],
  providers: [DriftsService],
})
export class DriftsModule {}
