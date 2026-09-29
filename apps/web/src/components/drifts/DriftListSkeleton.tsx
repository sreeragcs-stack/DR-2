import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriftListSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <Card key={index}><CardContent className="flex flex-wrap gap-6 p-5"><Skeleton className="h-6 w-24" /><Skeleton className="h-5 w-64" /><Skeleton className="h-5 w-36" /><Skeleton className="h-5 w-28" /></CardContent></Card>)}</div>;
}
