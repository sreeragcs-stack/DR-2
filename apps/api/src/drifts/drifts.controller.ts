import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateDriftDto, UpdateDriftDto } from './drifts.dto';
import { DriftsService } from './drifts.service';

@Controller('drifts')
@UseGuards(JwtAuthGuard)
export class DriftsController {
  constructor(private readonly service: DriftsService) {}

  @Get()
  list(@Query('status') status?: string) { return this.service.list(status); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateDriftDto) { return this.service.create(dto); }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateDriftDto) { return this.service.update(id, dto); }

  @Post(':id/approve')
  approve(@Param('id') id: string) { return this.service.approve(id); }

  @Post(':id/dismiss')
  dismiss(@Param('id') id: string) { return this.service.dismiss(id); }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
