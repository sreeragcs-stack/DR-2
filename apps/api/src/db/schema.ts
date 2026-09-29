import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['pm', 'admin']);
export const driftStatusEnum = pgEnum('drift_status', [
  'New',
  'Under review',
  'Approved',
  'Dismissed',
]);
export const impactTierEnum = pgEnum('impact_tier', ['HIGH', 'MEDIUM', 'LOW']);
export const sourceTypeEnum = pgEnum('source_type', ['Call', 'Email', 'Ticket comment']);
export const classificationOutcomeEnum = pgEnum('classification_outcome', ['consistent', 'clarification', 'deviation', 'net-new']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('pm').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const requirements = pgTable('requirements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prdText: text('prd_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const drifts = pgTable('drifts', {
  id: text('id').primaryKey(),
  requirementId: text('requirement_id').references(() => requirements.id, { onDelete: 'set null' }),
  status: driftStatusEnum('status').notNull(),
  impactTier: impactTierEnum('impact_tier'),
  bufferDays: integer('buffer_days'),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceDate: text('source_date').notNull(),
  sourceReference: text('source_reference'),
  quote: text('quote').notNull(),
  whyFlagged: text('why_flagged').notNull(),
  tierExplanation: text('tier_explanation').notNull(),
  crText: text('cr_text'),
  approvedAt: text('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const classificationRuns = pgTable('classification_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at').notNull(),
  fixtureVersion: text('fixture_version').notNull(),
});

export const classificationResults = pgTable('classification_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => classificationRuns.id),
  inputOrder: integer('input_order').notNull(),
  quote: text('quote').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceDate: text('source_date').notNull(),
  scopeRelated: boolean('scope_related').notNull(),
  outcome: classificationOutcomeEnum('outcome'),
  matchedRequirementId: text('matched_requirement_id').references(() => requirements.id),
  whyFlagged: text('why_flagged'),
  crText: text('cr_text'),
  createdDriftId: text('created_drift_id').references(() => drifts.id),
  duplicateActiveDriftId: text('duplicate_active_drift_id').references(() => drifts.id),
  expectedOutcome: text('expected_outcome'),
  expectedRequirementId: text('expected_requirement_id'),
  matchesExpected: boolean('matches_expected'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  classificationRuns: many(classificationRuns),
}));

export const requirementsRelations = relations(requirements, ({ many }) => ({
  drifts: many(drifts),
  classificationResults: many(classificationResults, { relationName: 'matchedRequirement' }),
}));

export const driftsRelations = relations(drifts, ({ one, many }) => ({
  requirement: one(requirements, {
    fields: [drifts.requirementId],
    references: [requirements.id],
  }),
  createdClassificationResults: many(classificationResults, { relationName: 'createdDrift' }),
  duplicateClassificationResults: many(classificationResults, { relationName: 'duplicateActiveDrift' }),
}));

export const classificationRunsRelations = relations(classificationRuns, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [classificationRuns.createdByUserId],
    references: [users.id],
  }),
  results: many(classificationResults),
}));

export const classificationResultsRelations = relations(classificationResults, ({ one }) => ({
  run: one(classificationRuns, {
    fields: [classificationResults.runId],
    references: [classificationRuns.id],
  }),
  matchedRequirement: one(requirements, {
    fields: [classificationResults.matchedRequirementId],
    references: [requirements.id],
    relationName: 'matchedRequirement',
  }),
  createdDrift: one(drifts, {
    fields: [classificationResults.createdDriftId],
    references: [drifts.id],
    relationName: 'createdDrift',
  }),
  duplicateActiveDrift: one(drifts, {
    fields: [classificationResults.duplicateActiveDriftId],
    references: [drifts.id],
    relationName: 'duplicateActiveDrift',
  }),
}));
