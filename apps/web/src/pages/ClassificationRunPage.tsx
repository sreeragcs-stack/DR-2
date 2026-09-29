import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClassificationRun } from '@/hooks/use-classification-run';

export default function ClassificationRunPage() {
  const { runId = '' } = useParams();
  const query = useClassificationRun(runId);
  if (query.isLoading) return <main className="container mx-auto max-w-7xl space-y-6 px-4 py-10 md:px-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></main>;
  if (query.isError) return <main className="container mx-auto max-w-7xl space-y-5 px-4 py-10 md:px-6"><Alert variant="destructive"><AlertCircle /><AlertTitle>Classification results unavailable</AlertTitle><AlertDescription>{query.error instanceof Error ? query.error.message : 'We could not load this classification run.'}</AlertDescription></Alert><Button asChild variant="outline"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Link></Button></main>;
  if (!query.data) return <main className="container mx-auto max-w-7xl space-y-5 px-4 py-10 md:px-6"><Alert><AlertCircle /><AlertTitle>Classification run not found</AlertTitle><AlertDescription>This classification run is no longer available.</AlertDescription></Alert><Button asChild variant="outline"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Link></Button></main>;

  const { run, results } = query.data;
  const created = results.filter(item => item.result.createdDriftId).length;
  const duplicates = results.filter(item => item.result.duplicateActiveDriftId).length;
  const consistent = results.filter(item => item.result.outcome === 'consistent').length;
  const netNew = results.filter(item => item.result.outcome === 'net-new').length;

  return <main className="container mx-auto max-w-7xl space-y-6 px-4 py-10 md:px-6">
    <Link to="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Link>
    <header><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{run.fixtureVersion}</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Classification Results</h1><p className="mt-2 text-muted-foreground">Completed {new Date(run.completedAt).toLocaleString()} by the signed-in reviewer.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[['Inputs', results.length], ['Created drifts', created], ['Duplicates suppressed', duplicates], ['Consistent', consistent], ['Net-new', netNew]].map(([label, value]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value}</p></CardContent></Card>)}</section>
    <Card><CardHeader><CardTitle>Audit results</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Input</TableHead><TableHead>Outcome</TableHead><TableHead>Matched requirement</TableHead><TableHead>CR text</TableHead><TableHead>Persistence result</TableHead></TableRow></TableHeader><TableBody>{results.map(item => { const result = item.result; const driftId = result.createdDriftId ?? result.duplicateActiveDriftId; return <TableRow key={result.id}><TableCell className="min-w-[240px]"><p className="font-medium">{result.inputOrder}. {result.quote}</p><p className="mt-1 text-xs text-muted-foreground">{result.sourceType}, {result.sourceDate}</p></TableCell><TableCell><Badge variant="outline">{result.outcome ?? 'Out of scope'}</Badge></TableCell><TableCell>{result.outcome === 'net-new' ? <span className="text-muted-foreground">No approved requirement match</span> : item.requirement ? <span><strong>{item.requirement.id}</strong><br /><span className="text-xs text-muted-foreground">{item.requirement.title}</span></span> : <span className="text-muted-foreground">No match</span>}</TableCell><TableCell className="max-w-[340px] whitespace-pre-line text-sm text-muted-foreground">{result.crText ?? 'No CR drafted'}</TableCell><TableCell>{result.outcome === 'consistent' || !result.scopeRelated ? <span className="text-muted-foreground">No drift created</span> : driftId ? <Link className="font-medium text-primary hover:underline" to={`/drifts/${driftId}`}>{result.createdDriftId ? `Created ${driftId}` : `Duplicate suppressed, ${driftId}`}</Link> : <span className="text-muted-foreground">No drift created</span>}</TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>
  </main>;
}
