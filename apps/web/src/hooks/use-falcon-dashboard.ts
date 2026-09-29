import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { driftDetailKey } from './use-drift-detail';

export const falconDashboardKey = ['dashboard', 'falcon'];

export function useFalconDashboard() {
  return useQuery({ queryKey: falconDashboardKey, queryFn: dashboardApi.falcon });
}

export function useRefreshFalconDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dashboardApi.refresh,
    onSuccess: (data) => {
      queryClient.setQueryData(falconDashboardKey, data);
      queryClient.invalidateQueries({ queryKey: ['drifts'] });
      queryClient.invalidateQueries({ queryKey: driftDetailKey(''), exact: false });
    },
  });
}
