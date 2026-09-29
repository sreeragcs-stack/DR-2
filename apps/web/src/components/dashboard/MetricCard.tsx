import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Props = { label: string; value?: number; icon: LucideIcon; tone: string; helper: string; loading?: boolean };

export default function MetricCard({ label, value, icon: Icon, tone, helper, loading }: Props) {
  return <Card className="overflow-hidden border-border/70 shadow-sm">
    <CardContent className="flex items-start justify-between p-5">
      <div className="space-y-2"><p className="text-sm font-medium text-muted-foreground">{label}</p>{loading ? <div className="h-9 w-16 animate-pulse rounded bg-muted" /> : <p className="text-3xl font-bold tracking-tight">{value}</p>}<p className="text-xs text-muted-foreground">{helper}</p></div>
      <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
    </CardContent>
  </Card>;
}
