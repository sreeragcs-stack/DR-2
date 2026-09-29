const TOKEN_KEY = 'drift_radar_token';

export type User = {
  id: string;
  email: string;
  role: 'pm' | 'admin';
  createdAt: string;
};

type AuthResponse = { accessToken: string; user: User };

export type DriftStatus = 'New' | 'Under review' | 'Approved' | 'Dismissed';
export type Drift = {
  drift: {
    id: string;
    requirementId: string | null;
    status: DriftStatus;
    impactTier: 'HIGH' | 'MEDIUM' | 'LOW' | null;
    bufferDays: number | null;
    sourceType: 'Call' | 'Email' | 'Ticket comment';
    sourceDate: string;
    sourceReference: string | null;
    quote: string;
    whyFlagged: string;
    tierExplanation: string;
    crText: string | null;
    approvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  requirement: { id: string; title: string; prdText: string } | null;
};

export type ClassificationOutcome = 'consistent' | 'clarification' | 'deviation' | 'net-new';
export type ClassificationResult = {
  result: {
    id: string;
    runId: string;
    inputOrder: number;
    quote: string;
    sourceType: 'Call' | 'Email' | 'Ticket comment';
    sourceDate: string;
    scopeRelated: boolean;
    outcome: ClassificationOutcome | null;
    matchedRequirementId: string | null;
    whyFlagged: string | null;
    crText: string | null;
    createdDriftId: string | null;
    duplicateActiveDriftId: string | null;
    expectedOutcome: ClassificationOutcome | null;
    expectedRequirementId: string | null;
    matchesExpected: boolean | null;
    createdAt: string;
  };
  requirement: { id: string; title: string; prdText: string } | null;
};

export type ClassificationRun = {
  run: { id: string; createdByUserId: string; createdAt: string; completedAt: string; fixtureVersion: string };
  results: ClassificationResult[];
};

export type FalconDashboard = {
  projectName: string;
  context: string;
  activeDriftCount: number;
  newDriftCount: number;
  tierCounts: { HIGH: number; MEDIUM: number; LOW: number };
  refreshedAt?: string;
};

function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    const error = new Error(message || 'Something went wrong. Please try again.') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const driftsApi = {
  list: (status?: DriftStatus) => request<Drift[]>(`/api/drifts${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => request<Drift>(`/api/drifts/${encodeURIComponent(id)}`),
  lifecycle: (id: string, action: 'approve' | 'dismiss') => request<Drift>(`/api/drifts/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
};

export type ClassificationStreamProgress = {
  total: number;
  completed: number;
  inputOrder?: number;
};

export type ClassificationStreamEvent =
  | { type: 'started'; data: ClassificationStreamProgress }
  | { type: 'progress'; data: ClassificationStreamProgress }
  | { type: 'completed'; data: ClassificationRun }
  | { type: 'failed'; data: { message: string } };

export type ClassificationStreamOptions = {
  onEvent?: (event: ClassificationStreamEvent) => void;
  signal?: AbortSignal;
};

function parseClassificationEvent(block: string): ClassificationStreamEvent {
  const lines = block.split(/\r?\n/);
  const eventName = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
  const dataText = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
  if (!eventName || !dataText || !['started', 'progress', 'completed', 'failed'].includes(eventName)) throw new Error('Classification stream returned malformed event data.');
  let data: unknown;
  try { data = JSON.parse(dataText); } catch { throw new Error('Classification stream returned malformed event data.'); }
  if (eventName === 'failed' && data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') return { type: 'failed', data: data as { message: string } };
  if ((eventName === 'started' || eventName === 'progress') && data && typeof data === 'object' && Number.isInteger((data as ClassificationStreamProgress).total) && Number.isInteger((data as ClassificationStreamProgress).completed)) return { type: eventName, data: data as ClassificationStreamProgress };
  if (eventName === 'completed' && data && typeof data === 'object' && 'run' in data && 'results' in data) return { type: 'completed', data: data as ClassificationRun };
  throw new Error('Classification stream returned malformed event data.');
}

async function startClassification(options: ClassificationStreamOptions = {}): Promise<ClassificationRun> {
  const token = getToken();
  const headers = new Headers({ Accept: 'text/event-stream' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch('/api/dashboard/falcon/classification-runs', { method: 'POST', headers, credentials: 'include', signal: options.signal });
  if (!response.ok || !response.body) throw new Error('Classification could not be completed. Try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed: ClassificationRun | undefined;
  let terminal = false;
  let started = false;
  const consume = (block: string) => {
    if (!block.trim() || terminal) return;
    const event = parseClassificationEvent(block);
    if (event.type === 'started') {
      if (started) throw new Error('Classification stream returned an unexpected event order.');
      started = true;
    } else if (!started) {
      throw new Error('Classification stream returned an unexpected event order.');
    }
    if (event.type === 'progress' && event.data.completed < 0) throw new Error('Classification stream returned invalid progress data.');
    options.onEvent?.(event);
    if (event.type === 'failed') { terminal = true; throw new Error(event.data.message); }
    if (event.type === 'completed') { terminal = true; completed = event.data; }
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) consume(frame);
    }
    buffer += decoder.decode();
    if (buffer.trim() && /(?:^|\r?\n)(?:event|data):/.test(buffer)) {
      try { consume(buffer); } catch (error) {
        if (!terminal) throw error;
      }
    }
  } finally { reader.releaseLock(); }
  if (!terminal || !completed) throw new Error('Classification stream ended before completion.');
  return completed;
}

export const dashboardApi = {
  falcon: () => request<FalconDashboard>('/api/dashboard/falcon'),
  refresh: () => request<FalconDashboard>('/api/dashboard/falcon/refresh', { method: 'POST' }),
  startClassification,
  getClassification: (runId: string) => request<ClassificationRun>(`/api/dashboard/falcon/classification-runs/${encodeURIComponent(runId)}`),
};

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};
