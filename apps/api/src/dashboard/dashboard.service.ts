import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { drifts, requirements } from '../db/schema';
import { OpenProjectClient } from './openproject.client';
import { calculateScan } from './openproject.scan';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly openProject: OpenProjectClient,
  ) {}

  async falcon() {
    const [active] = await this.db
      .select({ value: count() })
      .from(drifts)
      .where(inArray(drifts.status, ['New', 'Under review']));
    const [newDrifts] = await this.db
      .select({ value: count() })
      .from(drifts)
      .where(eq(drifts.status, 'New'));
    const [high] = await this.db
      .select({ value: count() })
      .from(drifts)
      .where(and(inArray(drifts.status, ['New', 'Under review']), eq(drifts.impactTier, 'HIGH')));
    const [medium] = await this.db
      .select({ value: count() })
      .from(drifts)
      .where(and(inArray(drifts.status, ['New', 'Under review']), eq(drifts.impactTier, 'MEDIUM')));
    const [low] = await this.db
      .select({ value: count() })
      .from(drifts)
      .where(and(inArray(drifts.status, ['New', 'Under review']), eq(drifts.impactTier, 'LOW')));

    return {
      projectName: 'Project Falcon',
      context: 'UAT starts 3 October 2026',
      activeDriftCount: Number(active.value),
      newDriftCount: Number(newDrifts.value),
      tierCounts: {
        HIGH: Number(high.value),
        MEDIUM: Number(medium.value),
        LOW: Number(low.value),
      },
    };
  }

  async refreshScan() {
    this.logger.log('OpenProject scan started');
    const config = this.openProject.getScanConfig();
    const workPackages = await this.openProject.listWorkPackages();
    this.logger.log(`OpenProject work packages fetched, count=${workPackages.length}`);
    const requirementRows = await this.db.select({ id: requirements.id }).from(requirements);
    const scanned = calculateScan(
      workPackages,
      new Set(requirementRows.map((requirement) => requirement.id)),
      config.milestoneDate,
    );
    const matched = new Map(scanned.map((item) => [item.requirementId, item]));
    this.logger.log(`OpenProject schedule candidates calculated, validCandidates=${scanned.length}, requirementMatches=${matched.size}`);

    await this.db.transaction(async (tx) => {
      const currentDrifts = await tx.select({ id: drifts.id, requirementId: drifts.requirementId }).from(drifts);
      for (const drift of currentDrifts) {
        const result = drift.requirementId ? matched.get(drift.requirementId) : undefined;
        await tx.update(drifts).set({
          bufferDays: result?.bufferDays ?? null,
          impactTier: result?.impactTier ?? null,
          updatedAt: new Date(),
        }).where(eq(drifts.id, drift.id));
      }
    });
    this.logger.log('OpenProject drift schedule persistence completed');

    const result = { ...(await this.falcon()), refreshedAt: new Date().toISOString() };
    this.logger.log('OpenProject scan completed');
    return result;
  }
}
