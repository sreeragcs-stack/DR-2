import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

export default function ProtectedLayout() {
  return <div className="min-h-screen bg-muted/20"><AppHeader /><Outlet /></div>;
}
