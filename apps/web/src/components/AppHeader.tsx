import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  async function logout() { await signOut(); navigate('/login', { replace: true }); }
  return <header className="border-b bg-background">
    <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-6"><Link to="/"><img src="/logo.png" alt="Drift Radar" className="h-10 w-auto" /></Link><nav className="hidden items-center gap-4 text-sm md:flex"><Link className="rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" to="/">Project Falcon</Link><Link className="rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" to="/drifts">Drift register</Link></nav></div>
      {user && <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-medium">{user.email}</p><p className="text-xs capitalize text-muted-foreground">{user.role}</p></div><Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Log out</Button></div>}
    </div>
  </header>;
}
