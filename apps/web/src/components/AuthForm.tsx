import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = { mode: 'login' | 'register' };

export default function AuthForm({ mode }: Props) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';
  const next = new URLSearchParams(location.search).get('next') || '/';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    if (isRegister && password !== confirmation) return setError('Passwords do not match.');
    setSubmitting(true);
    try { await signIn(email.trim(), password, isRegister); navigate(next, { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setSubmitting(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-3 text-center">
        <img src="/logo.png" alt="Drift Radar" className="mx-auto h-10 w-auto" />
        <CardTitle>{isRegister ? 'Create your account' : 'Welcome back'}</CardTitle>
        <CardDescription>{isRegister ? 'Join the Project Falcon review workspace.' : 'Sign in to review scope changes in Project Falcon.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" autoComplete="email" type="email" placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={Boolean(error && (!email.trim() || !email.includes('@')))} /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} /></div>
          {isRegister && <div className="space-y-2"><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" name="confirmation" autoComplete="new-password" type="password" placeholder="Repeat your password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>}
          {error && <p id="auth-error" role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}</Button>
          {!isRegister && <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm"><p className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-primary" />Development access</p><p className="mt-1 flex items-center gap-2 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />admin@example.com, Admin123!</p></div>}<p className="text-center text-sm text-muted-foreground">{isRegister ? 'Already have an account? ' : 'Need an account? '}<Link className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Register'}</Link></p>
        </form>
      </CardContent>
    </Card>
  </main>;
}
