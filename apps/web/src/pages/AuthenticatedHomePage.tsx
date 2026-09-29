import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ClipboardList, Gauge, Layers3, ListChecks, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFalconDashboard, useRefreshFalconDashboard } from '@/hooks/use-falcon-dashboard';
import { useStartClassification } from '@/hooks/use-classification-run';
import MetricCard from '@/components/dashboard/MetricCard';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';

export default function AuthenticatedHomePage() {
  const dashboard = useFalconDashboard();
  const refresh = useRefreshFalconDashboard();
  const classification = useStartClassification();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  async function runScan() {
    try {
      await refresh.mutateAsync();
      toast.success('OpenProject schedule scan complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reach OpenProject - check connection and scan configuration.");
    }
  }

  async function runClassification() {
    try {
      const result = await classification.mutateAsync();
      navigate(`/classification-runs/${result.run.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Classification could not be completed. Try again.');
    }
  }

  async function retryClassification() {
    try {
      const result = await classification.mutateAsync();
      navigate(`/classification-runs/${result.run.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Classification could not be completed. Try again.');
    }
  }

  async function retry() {
    setRetrying(true);
    try { await dashboard.refetch(); } finally { setRetrying(false); }
  }

  if (dashboard.isLoading) return <main className="container mx-auto max-w-7xl px-4 py-10 md:px-6"><DashboardSkeleton /></main>;
  if (dashboard.isError) return <main className="container mx-auto max-w-7xl px-4 py-10 md:px-6"><Alert variant="destructive"><AlertCircle /><AlertTitle>Dashboard unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center gap-3"><span>We could not load the Project Falcon register.</span><Button variant="outline" size="sm" onClick={retry} disabled={retrying}>{retrying ? 'Trying again...' : 'Try again'}</Button></AlertDescription></Alert></main>;
  const data = dashboard.data;
  if (!data) return null;

  const cards = [
    { label: 'Active drifts', value: data.activeDriftCount, icon: Layers3, tone: 'bg-primary/10 text-primary', helper: 'Excludes approved and dismissed' },
    { label: 'New drifts', value: data.newDriftCount, icon: Sparkles, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', helper: 'Need initial review' },
    { label: 'HIGH impact', value: data.tierCounts.HIGH, icon: Gauge, tone: 'bg-red-500/10 text-red-700 dark:text-red-300', helper: 'Active only' },
    { label: 'MEDIUM impact', value: data.tierCounts.MEDIUM, icon: ListChecks, tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', helper: 'Active only' },
    { label: 'LOW impact', value: data.tierCounts.LOW, icon: ClipboardList, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', helper: 'Active only' },
  ];

  return <main className="container mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-6">
    <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{data.projectName}</p><h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Scope, kept in view.</h1><p className="mt-3 text-lg text-muted-foreground">{data.context}. Review every change against the approved PRD.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto"><Button onClick={runScan} disabled={refresh.isPending || classification.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />{refresh.isPending ? 'Refreshing...' : 'Run Scan'}</Button><Button onClick={runClassification} disabled={classification.isPending || refresh.isPending} variant="secondary"><Sparkles className={`mr-2 h-4 w-4 ${classification.isPending ? 'animate-pulse' : ''}`} />{classification.isPending ? 'Running classification...' : 'Run Classification'}</Button></div></section>
    <Alert className="border-primary/20 bg-primary/5"><ShieldCheck /><AlertTitle>Schedule data is connected to OpenProject</AlertTitle><AlertDescription>Run Scan retrieves OpenProject work-package due dates and updates local drift schedule risk. Review notes and lifecycle decisions remain local.</AlertDescription></Alert>
    {(classification.isPending || classification.isError) && <Card className="border-primary/20"><CardContent className="space-y-4 p-5">{classification.isPending ? <><div className="flex items-center gap-3"><Sparkles className="h-5 w-5 animate-pulse text-primary" /><div><h2 className="font-semibold">{classification.progress ? `Classifying communications - ${classification.progress.completed} of ${classification.progress.total} complete` : 'Connecting to classification service...'}</h2><p className="text-sm text-muted-foreground">No completed run is saved until all communications finish.</p></div></div>{classification.progress && <Progress value={(classification.progress.completed / classification.progress.total) * 100} aria-label={`${classification.progress.completed} of ${classification.progress.total} communications classified`} />}</> : <Alert variant="destructive"><AlertCircle /><AlertTitle>Classification did not complete</AlertTitle><AlertDescription className="flex flex-wrap items-center gap-3"><span>{classification.error instanceof Error ? classification.error.message : 'No completed run was saved. Try again.'}</span><Button variant="outline" size="sm" onClick={retryClassification}>Try again</Button></AlertDescription></Alert>}</CardContent></Card>}
    <section aria-label="Drift summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{cards.map(card => <MetricCard key={card.label} {...card} />)}</section>
    {data.activeDriftCount === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><ClipboardList className="h-10 w-10 text-muted-foreground" /><h2 className="text-xl font-semibold">No active drifts in the local register</h2><p className="text-sm text-muted-foreground">Dismissed records are kept for history and do not need review.</p></CardContent></Card> : <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Ready for review?</h2><p className="mt-1 text-sm text-muted-foreground">Open the register to inspect evidence, PRD context, and fixed review notes.</p></div><Button asChild variant="outline"><Link to="/drifts">Open drift register <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>}
  </main>;
}
