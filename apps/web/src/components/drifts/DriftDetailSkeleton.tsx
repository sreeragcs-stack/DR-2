import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriftDetailSkeleton() {
  return <div className="space-y-6"><Skeleton className="h-5 w-40" /><div className="space-y-2"><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-96 max-w-full" /></div>{Array.from({ length: 4 }).map((_, index) => <Card key={index}><CardHeader><Skeleton className="h-4 w-44" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>;
}
