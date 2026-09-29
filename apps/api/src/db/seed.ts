import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

config({ path: '../../.env' });

import postgres from 'postgres';
import * as bcrypt from 'bcryptjs';
import * as schema from './schema';
import { classificationResults, classificationRuns, drifts, requirements, users } from './schema';
import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { falconDrifts, falconRequirements } from './seed-data';

async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await db
    .insert(users)
    .values({
      email: 'admin@example.com',
      passwordHash,
      role: 'admin',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: 'admin' },
    });

  for (const requirement of falconRequirements) {
    await db
      .insert(requirements)
      .values(requirement)
      .onConflictDoUpdate({
        target: requirements.id,
        set: {
          title: requirement.title,
          prdText: requirement.prdText,
          updatedAt: new Date(),
        },
      });
  }

  for (const drift of falconDrifts) {
    await db
      .insert(drifts)
      .values(drift)
      .onConflictDoUpdate({
        target: drifts.id,
        set: drift.id === 'DR-001'
          ? { requirementId: drift.requirementId, tierExplanation: drift.tierExplanation, updatedAt: new Date() }
          : { requirementId: drift.requirementId, updatedAt: new Date() },
      });
  }

  await db.transaction(async (tx) => {
    const legacyRuns = await tx.select({ id: classificationRuns.id }).from(classificationRuns).where(eq(classificationRuns.fixtureVersion, 'falcon-test-batch-v1'));
    const legacyRunIds = legacyRuns.map((run) => run.id);
    const createdIds = legacyRunIds.length
      ? (await tx.select({ createdDriftId: classificationResults.createdDriftId }).from(classificationResults).where(inArray(classificationResults.runId, legacyRunIds))).map((result) => result.createdDriftId).filter((id): id is string => id !== null)
      : [];
    const placeholderIds = ['DR-001', 'DR-002', 'DR-003', 'DR-004', 'DR-005', 'DR-006'];
    const staleDrifts = await tx.select({ id: drifts.id }).from(drifts).where(and(
      inArray(drifts.requirementId, ['R-02', 'R-03', 'R-04', 'R-06', 'R-08']),
      or(sql`${drifts.sourceDate} like ${'%July 2026%'}`, sql`${drifts.sourceDate} like ${'%August 2026%'}`, sql`${drifts.sourceDate} like ${'%July%'}`, sql`${drifts.sourceDate} like ${'%August%'}`),
    ));
    const legacyDriftIds = [...new Set([...createdIds, ...placeholderIds, ...staleDrifts.map((drift) => drift.id)])];
    if (legacyDriftIds.length) {
      await tx.delete(classificationResults).where(or(
        inArray(classificationResults.createdDriftId, legacyDriftIds),
        inArray(classificationResults.duplicateActiveDriftId, legacyDriftIds),
      ));
    }
    if (legacyRunIds.length) await tx.delete(classificationResults).where(inArray(classificationResults.runId, legacyRunIds));
    if (legacyRunIds.length) await tx.delete(classificationRuns).where(inArray(classificationRuns.id, legacyRunIds));
    if (legacyDriftIds.length) await tx.delete(drifts).where(inArray(drifts.id, legacyDriftIds));
  });

  const referencedRequirementIds = (await db
    .select({ requirementId: drifts.requirementId })
    .from(drifts))
    .map((drift) => drift.requirementId);
  const obsoleteRequirements = ['R-14', 'R-19'].filter(
    (id) => !referencedRequirementIds.includes(id),
  );
  const referencedIds = referencedRequirementIds.filter((id): id is string => id !== null);
  for (const id of obsoleteRequirements) {
    await db.delete(requirements).where(
      and(eq(requirements.id, id), notInArray(requirements.id, referencedIds)),
    );
  }

  console.log('seeded Drift Radar admin and finalized requirements; cleaned legacy runs and obsolete July/August placeholder drifts');
  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
