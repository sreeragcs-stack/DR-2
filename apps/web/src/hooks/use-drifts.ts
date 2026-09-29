import { useQuery } from '@tanstack/react-query';
import { driftsApi, type DriftStatus } from '@/lib/api';

export const driftsKey = (status: DriftStatus | undefined) => ['drifts', status ?? 'all'];

export function useDrifts(status?: DriftStatus) {
  return useQuery({ queryKey: driftsKey(status), queryFn: () => driftsApi.list(status) });
}
