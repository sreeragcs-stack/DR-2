import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, ne, or } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { classificationResults, classificationRuns, drifts } from './schema';

config({ path: '../../.env' });

const activeStatuses = ['New', 'Under review', 'Approved'] as const;

type DriftRow = { id: string; requirementId: string | null; quote: string; sourceType: string; sourceDate: string; createdAt: Date };

async function cleanupDuplicates() {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error('DATABASE_URL is not set');
  const client = postgres(connection);
  const db = drizzle(client, { schema });
  try {
    const report = await db.transaction(async (tx) => {
      const beforeRows = await tx.select({ status: drifts.status }).from(drifts);
      const beforeActive = beforeRows.filter((row) => activeStatuses.includes(row.status as typeof activeStatuses[number])).length;
      const beforeNew = beforeRows.filter((row) => row.status === 'New').length;

      const classifierRows = await tx
        .select({ drift: drifts })
        .from(drifts)
        .innerJoin(classificationResults, eq(classificationResults.createdDriftId, drifts.id))
        .where(ne(drifts.status, 'Dismissed'));
      const unique = new Map<string, DriftRow>();
      for (const row of classifierRows) unique.set(row.drift.id, row.drift);

      const groups = new Map<string, DriftRow[]>();
      for (const drift of unique.values()) {
        const key = drift.requirementId
          ? `requirement:${drift.requirementId}`
          : `net-new:${JSON.stringify([drift.quote, drift.sourceType, drift.sourceDate])}`;
        const group = groups.get(key) ?? [];
        group.push(drift);
        groups.set(key, group);
      }

      const deletedIds: string[] = [];
      const retainedIds: string[] = [];
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        group.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
        retainedIds.push(group[0].id);
        deletedIds.push(...group.slice(1).map((drift) => drift.id));
      }

      let clearedLinks = 0;
      if (deletedIds.length) {
        const references = await tx.select({ id: classificationResults.id }).from(classificationResults).where(or(
          ...deletedIds.map((id) => or(eq(classificationResults.createdDriftId, id), eq(classificationResults.duplicateActiveDriftId, id))),
        ));
        clearedLinks = references.length;
        await tx.update(classificationResults).set({ createdDriftId: null, duplicateActiveDriftId: null }).where(or(
          ...deletedIds.map((id) => or(eq(classificationResults.createdDriftId, id), eq(classificationResults.duplicateActiveDriftId, id))),
        ));
        await tx.delete(drifts).where(or(...deletedIds.map((id) => eq(drifts.id, id))));
      }

      const runs = await tx.select({ id: classificationRuns.id }).from(classificationRuns);
      const resultRows = await tx.select({ runId: classificationResults.runId }).from(classificationResults);
      const runsWithResults = new Set(resultRows.map((row) => row.runId));
      const resultlessRunIds = runs.map((run) => run.id).filter((id) => !runsWithResults.has(id));
      if (resultlessRunIds.length) await tx.delete(classificationRuns).where(or(...resultlessRunIds.map((id) => eq(classificationRuns.id, id))));

      const afterRows = await tx.select({ status: drifts.status }).from(drifts);
      return {
        beforeActive,
        beforeNew,
        afterActive: afterRows.filter((row) => activeStatuses.includes(row.status as typeof activeStatuses[number])).length,
        afterNew: afterRows.filter((row) => row.status === 'New').length,
        retainedIds,
        deletedIds,
        clearedLinks,
        removedResultlessRuns: resultlessRunIds.length,
      };
    });
    console.log(JSON.stringify({ message: 'Historical duplicate cleanup complete', ...report }));
  } finally {
    await client.end();
  }
}

cleanupDuplicates().catch((error) => {
  console.error(error);
  process.exit(1);
});
