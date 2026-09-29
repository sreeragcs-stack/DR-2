import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { classificationResults, drifts, requirements, driftStatusEnum } from '../db/schema';
import type { CreateDriftDto, UpdateDriftDto } from './drifts.dto';

@Injectable()
export class DriftsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private joined() {
    return this.db.select({ drift: drifts, requirement: requirements }).from(drifts).leftJoin(requirements, eq(drifts.requirementId, requirements.id));
  }

  async list(status?: string) {
    const query = this.joined();
    if (status) {
      if (!driftStatusEnum.enumValues.includes(status as typeof driftStatusEnum.enumValues[number])) {
        throw new BadRequestException('Status must be New, Under review, Approved, or Dismissed');
      }
      return query.where(eq(drifts.status, status as typeof driftStatusEnum.enumValues[number])).orderBy(desc(drifts.createdAt));
    }
    return query.orderBy(desc(drifts.createdAt));
  }

  async get(id: string) {
    const [row] = await this.joined().where(eq(drifts.id, id));
    if (!row) throw new NotFoundException('Drift not found');
    return row;
  }

  async create(dto: CreateDriftDto) {
    await this.requireRequirement(dto.requirementId);
    try {
      await this.db.insert(drifts).values(dto);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Drift ID already exists');
      throw error;
    }
    return this.get(dto.id);
  }

  async update(id: string, dto: UpdateDriftDto) {
    await this.get(id);
    if (dto.requirementId) await this.requireRequirement(dto.requirementId);
    await this.db.update(drifts).set({ ...dto, updatedAt: new Date() }).where(eq(drifts.id, id));
    return this.get(id);
  }

  async remove(id: string) {
    await this.get(id);
    await this.db.delete(drifts).where(eq(drifts.id, id));
    return { ok: true };
  }

  async approve(id: string) {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(drifts).where(eq(drifts.id, id));
      if (!current) throw new NotFoundException('Drift not found');
      if (current.status !== 'New' && current.status !== 'Under review') {
        throw new ConflictException('Only New or Under review drifts can be approved');
      }
      const approvalStamp = `Approved - ${this.localDate(now)}.`;
      const crText = current.crText
        ? current.crText.includes('Approved')
          ? current.crText
          : `${current.crText}\n${approvalStamp}`
        : null;
      await tx.update(drifts).set({
        status: 'Approved',
        crText,
        approvedAt: this.localDate(now),
        updatedAt: now,
      }).where(and(eq(drifts.id, id), inArray(drifts.status, ['New', 'Under review'])));
    });
    return this.get(id);
  }

  async dismiss(id: string) {
    await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(drifts).where(eq(drifts.id, id));
      if (!current) throw new NotFoundException('Drift not found');
      if (current.status !== 'New' && current.status !== 'Under review') {
        throw new ConflictException('Only New or Under review drifts can be dismissed');
      }
      await tx.update(drifts).set({
        status: 'Dismissed',
        crText: null,
        approvedAt: null,
        updatedAt: new Date(),
      }).where(and(eq(drifts.id, id), inArray(drifts.status, ['New', 'Under review'])));
    });
    return this.get(id);
  }

  private localDate(date: Date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  private async requireRequirement(id: string) {
    const [requirement] = await this.db.select({ id: requirements.id }).from(requirements).where(eq(requirements.id, id));
    if (!requirement) throw new NotFoundException('Requirement not found');
  }

  private isUniqueViolation(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
