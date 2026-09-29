import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardSkeleton() {
  return <div className="space-y-6"><div className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-96 max-w-full" /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Card key={index}><CardContent className="space-y-3 p-5"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-16" /><Skeleton className="h-3 w-24" /></CardContent></Card>)}</div></div>;
}
