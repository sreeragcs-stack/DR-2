import { BadRequestException } from '@nestjs/common';
import type { OpenProjectWorkPackage } from './openproject.client';

export type ScanDrift = { requirementId: string; bufferDays: number; impactTier: 'HIGH' | 'MEDIUM' | 'LOW'; subject: string; dueDate: string };

export function parseRequirementPrefix(subject: string): string | null {
  const match = /^\[(R-\d{2})\]\s+/.exec(subject.trim());
  return match?.[1] ?? null;
}

export function parseUtcDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calendarDayDifference(milestone: string, dueDate: string): number {
  const milestoneDate = parseUtcDate(milestone);
  const due = parseUtcDate(dueDate);
  if (!milestoneDate || !due) throw new BadRequestException('MILESTONE_DATE must use YYYY-MM-DD format.');
  return Math.round((milestoneDate.getTime() - due.getTime()) / 86400000);
}

export function impactTier(bufferDays: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (bufferDays <= 2) return 'HIGH';
  if (bufferDays <= 7) return 'MEDIUM';
  return 'LOW';
}

export function calculateScan(workPackages: OpenProjectWorkPackage[], requirementIds: Set<string>, milestoneDate: string): ScanDrift[] {
  const smallest = new Map<string, ScanDrift>();
  for (const workPackage of workPackages) {
    if (typeof workPackage.subject !== 'string' || typeof workPackage.dueDate !== 'string') continue;
    const requirementId = parseRequirementPrefix(workPackage.subject);
    if (!requirementId || !requirementIds.has(requirementId)) continue;
    const due = parseUtcDate(workPackage.dueDate);
    if (!due) continue;
    const bufferDays = calendarDayDifference(milestoneDate, workPackage.dueDate);
    const item: ScanDrift = { requirementId, bufferDays, impactTier: impactTier(bufferDays), subject: workPackage.subject, dueDate: workPackage.dueDate };
    const previous = smallest.get(requirementId);
    if (!previous || item.bufferDays < previous.bufferDays) smallest.set(requirementId, item);
  }
  return [...smallest.values()];
}
