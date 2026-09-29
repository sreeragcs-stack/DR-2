import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Drift } from '@/lib/api';
import { StatusBadge, TierBadge } from './DriftBadges';

function preview(value: string) { return value.length > 105 ? `${value.slice(0, 105).trim()}...` : value; }
function source(item: Drift['drift']) { return `${item.sourceType}${item.sourceReference ? `, ${item.sourceReference}` : ''} | ${item.sourceDate}`; }

export default function DriftTable({ items }: { items: Drift[] }) {
  const navigate = useNavigate();
  return <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
    <Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>What changed</TableHead><TableHead>Source</TableHead><TableHead>Affects</TableHead><TableHead>Buffer</TableHead><TableHead>Impact tier</TableHead></TableRow></TableHeader>
      <TableBody>{items.filter(item => item?.drift).map(item => <TableRow key={item.drift.id} tabIndex={0} className="cursor-pointer outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => navigate(`/drifts/${item.drift.id}`)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/drifts/${item.drift.id}`); } }}>
        <TableCell><StatusBadge status={item.drift.status} /></TableCell><TableCell className="max-w-[280px] text-sm">{preview(item.drift.whyFlagged)}</TableCell><TableCell className="whitespace-nowrap text-sm text-muted-foreground">{source(item.drift)}</TableCell><TableCell className="whitespace-nowrap">{item.requirement ? <><span className="font-medium">{item.requirement.id}</span><span className="ml-2 text-sm text-muted-foreground">{item.requirement.title}</span></> : <span className="text-sm text-muted-foreground">No related requirement</span>}</TableCell><TableCell className="whitespace-nowrap text-sm">{item.drift.bufferDays === null ? 'No ticket yet' : `${item.drift.bufferDays} days`}</TableCell><TableCell><TierBadge tier={item.drift.impactTier} /></TableCell>
      </TableRow>)}</TableBody></Table>
  </div>;
}