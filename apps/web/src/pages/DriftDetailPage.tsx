import { useState } from 'react';
import { ArrowLeft, FileText, MessageSquareQuote, ShieldAlert, AlertCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDriftDetail, useDriftLifecycle } from '@/hooks/use-drift-detail';
import { StatusBadge, TierBadge } from '@/components/drifts/DriftBadges';
import DriftDetailSkeleton from '@/components/drifts/DriftDetailSkeleton';
import ReviewDialog from '@/components/drifts/ReviewDialog';

export default function DriftDetailPage() {
  const { driftId = '' } = useParams();
  const query = useDriftDetail(driftId);
  const lifecycle = useDriftLifecycle(driftId);
  const [dialog, setDialog] = useState<'approve' | 'dismiss' | null>(null);
  if (query.isLoading) return <main className="container mx-auto max-w-4xl px-4 py-10 md:px-6"><DriftDetailSkeleton /></main>;
  if (query.isError || !query.data) return <main className="container mx-auto max-w-4xl space-y-5 px-4 py-10 md:px-6"><Alert variant="destructive"><AlertCircle /><AlertTitle>{query.error instanceof Error && (((query.error as Error & { status?: number }).status === 404) || /not found/i.test(query.error.message)) ? 'Drift not found' : 'Drift unavailable'}</AlertTitle><AlertDescription>{query.error instanceof Error ? query.error.message : 'We could not load this drift.'}</AlertDescription></Alert><Button asChild variant="outline"><Link to="/drifts"><ArrowLeft className="mr-2 h-4 w-4" />Back to register</Link></Button></main>;

  const { drift, requirement } = query.data;
  const actionable = drift.status === 'New' || drift.status === 'Under review';
  async function confirm() { if (!dialog) return; try { await lifecycle.mutateAsync(dialog); toast.success(dialog === 'approve' ? 'Change request approved locally' : 'Drift dismissed as a clarification'); setDialog(null); } catch (error) { toast.error(error instanceof Error ? error.message : 'The review action could not be completed.'); } }
  return <main className="container mx-auto max-w-4xl space-y-6 px-4 py-10 md:px-6"><Link to="/drifts" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" />Back to drift register</Link><header className="flex flex-col justify-between gap-4 rounded-xl border border-primary/10 bg-primary/[0.03] p-5 pb-6 shadow-sm sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{drift.id}</span><StatusBadge status={drift.status} /><TierBadge tier={drift.impactTier} /></div><h1 className="mt-3 text-3xl font-bold tracking-tight">{requirement ? requirement.title : 'New scope — no related requirement'}</h1><p className="mt-2 text-muted-foreground">{requirement ? `${requirement.id}, ${requirement.title}` : 'Not tied to an existing PRD requirement'}</p></div><div className="text-sm text-muted-foreground">{drift.sourceType}{drift.sourceReference ? `, ${drift.sourceReference}` : ''}<br />{drift.sourceDate}</div></header>
    <DetailSection icon={MessageSquareQuote} title="WHAT WAS SAID"><blockquote className="border-l-2 border-primary pl-4 text-lg italic leading-8">“{drift.quote}”</blockquote><p className="mt-4 text-sm text-muted-foreground">Source: {drift.sourceType}{drift.sourceReference ? `, ${drift.sourceReference}` : ''}, {drift.sourceDate}</p></DetailSection>
    <DetailSection icon={FileText} title="WHAT THE PRD SAYS">{requirement ? <><p className="font-medium">{requirement.id}, {requirement.title}</p><p className="mt-3 leading-7 text-muted-foreground">{requirement.prdText}</p></> : <p className="leading-7 text-muted-foreground">This request doesn't match any of the 12 requirements in the PRD — it's net-new scope.</p>}</DetailSection>
    <DetailSection icon={ShieldAlert} title="WHY IT'S FLAGGED"><p className="leading-7 text-muted-foreground">{drift.whyFlagged}</p></DetailSection>
    <DetailSection icon={ShieldAlert} title={`WHY ${drift.impactTier ?? 'NO TICKET YET'}`}><p className="leading-7 text-muted-foreground">Buffer: {drift.bufferDays === null ? 'No ticket yet' : `${drift.bufferDays} days`}</p><p className="mt-3 leading-7 text-muted-foreground">{drift.tierExplanation}</p><p className="mt-4 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">Tier explanation from the local review register. Schedule risk is refreshed from OpenProject when a scan runs.</p></DetailSection>
    {drift.crText && <DetailSection icon={FileText} title="DRAFT CHANGE REQUEST"><p className="whitespace-pre-line leading-7 text-muted-foreground">{drift.crText}</p>{drift.approvedAt && <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">Approved {drift.approvedAt}</p>}</DetailSection>}
    <footer className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-background p-5 pt-6 shadow-sm">{actionable ? <div className="flex flex-col gap-3 sm:flex-row"><Button onClick={() => setDialog('approve')} disabled={lifecycle.isPending}>Approve as change request</Button><Button variant="outline" onClick={() => setDialog('dismiss')} disabled={lifecycle.isPending}>Dismiss</Button></div> : <p className="text-sm font-medium text-muted-foreground">This drift is final and no longer has review actions.</p>}</footer><ReviewDialog action={dialog ?? 'approve'} open={dialog !== null} onOpenChange={open => !open && setDialog(null)} onConfirm={confirm} pending={lifecycle.isPending} />
  </main>;
}

function DetailSection({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }