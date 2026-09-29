import { AlertCircle, ClipboardList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDrifts } from '@/hooks/use-drifts';
import type { DriftStatus } from '@/lib/api';
import DriftTable from '@/components/drifts/DriftTable';
import DriftCards from '@/components/drifts/DriftCards';
import DriftListSkeleton from '@/components/drifts/DriftListSkeleton';

const filters: Array<{ label: string; value: DriftStatus | 'all' }> = [
  { label: 'All drifts', value: 'all' }, { label: 'New', value: 'New' }, { label: 'Under review', value: 'Under review' }, { label: 'Approved', value: 'Approved' }, { label: 'Dismissed', value: 'Dismissed' },
];

export default function DriftsPage() {
  const [params, setParams] = useSearchParams();
  const selected = filters.some(filter => filter.value === params.get('status')) ? params.get('status') as DriftStatus | 'all' : 'all';
  const query = useDrifts(selected === 'all' ? undefined : selected);
  function setFilter(value: string) { const next = new URLSearchParams(params); if (value === 'all') next.delete('status'); else next.set('status', value); setParams(next); }
  return <main className="container mx-auto max-w-7xl space-y-6 px-4 py-10 md:px-6"><section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="space-y-1"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Project Falcon</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Drift register</h1><p className="mt-3 text-muted-foreground">Review local scope changes against the approved PRD.</p></div><Select value={selected} onValueChange={setFilter}><SelectTrigger className="w-full sm:w-48" aria-label="Filter drifts"><SelectValue /></SelectTrigger><SelectContent>{filters.map(filter => <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>)}</SelectContent></Select></section>
    {query.isLoading ? <DriftListSkeleton /> : query.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Register unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center gap-3"><span>We could not load the drift register.</span><Button size="sm" variant="outline" onClick={() => query.refetch()}>Try again</Button></AlertDescription></Alert> : query.data?.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><ClipboardList className="h-10 w-10 text-muted-foreground" /><h2 className="text-xl font-semibold">No {selected === 'all' ? '' : selected.toLowerCase()} drifts found</h2><p className="text-sm text-muted-foreground">Try another status filter to view more of the local register.</p></CardContent></Card> : <><DriftTable items={query.data ?? []} /><DriftCards items={query.data ?? []} /></>}
  </main>;
}
