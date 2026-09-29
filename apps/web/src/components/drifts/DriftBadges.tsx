import { Badge } from '@/components/ui/badge';
import type { DriftStatus } from '@/lib/api';

const statusStyles: Record<DriftStatus, string> = {
  New: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  'Under review': 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  Dismissed: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

export function StatusBadge({ status }: { status: DriftStatus }) {
  return <Badge variant="outline" className={statusStyles[status]}>{status}</Badge>;
}

export function TierBadge({ tier }: { tier: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  if (!tier) return <Badge variant="outline" className="text-muted-foreground">No ticket yet</Badge>;
  const styles = { HIGH: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200', MEDIUM: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200', LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' };
  return <Badge variant="outline" className={styles[tier]}>{tier}</Badge>;
}
