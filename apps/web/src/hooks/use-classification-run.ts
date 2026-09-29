import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, type ClassificationStreamEvent, type ClassificationStreamProgress } from '@/lib/api';
import { driftDetailKey } from './use-drift-detail';
import { useEffect, useRef, useState } from 'react';

export const classificationRunKey = (id: string) => ['classification-run', id];

export function useClassificationRun(id: string) {
  return useQuery({ queryKey: classificationRunKey(id), queryFn: () => dashboardApi.getClassification(id), enabled: Boolean(id) });
}

export function useStartClassification() {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ClassificationStreamProgress | null>(null);
  const mutation = useMutation({
    mutationFn: () => {
      controller.current = new AbortController();
      setProgress(null);
      return dashboardApi.startClassification({ signal: controller.current.signal, onEvent: (event: ClassificationStreamEvent) => {
        if (event.type === 'started' || event.type === 'progress') setProgress(event.data);
        if (event.type === 'failed' || event.type === 'completed') setProgress(null);
      } });
    },
    onSuccess: (data) => {
      setProgress(null);
      queryClient.setQueryData(classificationRunKey(data.run.id), data);
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'falcon'] });
      queryClient.invalidateQueries({ queryKey: ['drifts'] });
      queryClient.invalidateQueries({ queryKey: driftDetailKey(''), exact: false });
    },
    onError: () => setProgress(null),
    onSettled: () => { controller.current = null; setProgress(null); },
  });
  useEffect(() => () => controller.current?.abort(), []);
  return { ...mutation, progress };
}
