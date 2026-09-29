import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateRequirementDto, UpdateRequirementDto } from './requirements.dto';
import { RequirementsService } from './requirements.service';

@Controller('requirements')
@UseGuards(JwtAuthGuard)
export class RequirementsController {
  constructor(private readonly service: RequirementsService) {}

  @Get()
  list() { return this.service.list(); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateRequirementDto) { return this.service.create(dto); }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateRequirementDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
