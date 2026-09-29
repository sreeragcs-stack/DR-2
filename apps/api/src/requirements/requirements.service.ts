import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { classificationResults, drifts, requirements } from '../db/schema';
import type { CreateRequirementDto, UpdateRequirementDto } from './requirements.dto';

@Injectable()
export class RequirementsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(requirements).orderBy(requirements.id);
  }

  async get(id: string) {
    const [requirement] = await this.db.select().from(requirements).where(eq(requirements.id, id));
    if (!requirement) throw new NotFoundException('Requirement not found');
    return requirement;
  }

  async create(dto: CreateRequirementDto) {
    try {
      const [requirement] = await this.db.insert(requirements).values(dto).returning();
      return requirement;
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Requirement ID already exists');
      throw error;
    }
  }

  async update(id: string, dto: UpdateRequirementDto) {
    await this.get(id);
    const [requirement] = await this.db
      .update(requirements)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(requirements.id, id))
      .returning();
    return requirement;
  }

  async remove(id: string) {
    await this.get(id);
    const [referenced] = await this.db.select({ id: drifts.id }).from(drifts).where(eq(drifts.requirementId, id)).limit(1);
    const [classificationReference] = await this.db.select({ id: classificationResults.id }).from(classificationResults).where(eq(classificationResults.matchedRequirementId, id)).limit(1);
    if (referenced || classificationReference) throw new ConflictException('Requirement cannot be deleted while drifts or classification results reference it');
    await this.db.delete(requirements).where(eq(requirements.id, id));
    return { ok: true };
  }

  private isUniqueViolation(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
