import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, driftsApi, type Drift } from '@/lib/api';

export const driftDetailKey = (id: string) => ['drifts', 'detail', id];

export function useDriftDetail(id: string) {
  return useQuery({ queryKey: driftDetailKey(id), queryFn: () => driftsApi.get(id), enabled: Boolean(id) });
}

export function useDriftLifecycle(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: 'approve' | 'dismiss') => driftsApi.lifecycle(id, action),
    onSuccess: (data: Drift) => {
      client.setQueryData(driftDetailKey(id), data);
      client.invalidateQueries({ queryKey: ['drifts'] });
      client.invalidateQueries({ queryKey: ['dashboard', 'falcon'] });
    },
  });
}
