import { AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Props = { action: 'approve' | 'dismiss'; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; pending: boolean };
export default function ReviewDialog({ action, open, onOpenChange, onConfirm, pending }: Props) {
  const approve = action === 'approve';
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />{approve ? 'Approve as change request?' : 'Dismiss this drift?'}</AlertDialogTitle><AlertDialogDescription>{approve ? 'This finalizes the existing drafted change request locally. Nothing will be sent or created externally.' : 'This marks the item as a clarification and permanently removes its drafted change-request text.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction className={approve ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'} onClick={onConfirm} disabled={pending}>{pending ? 'Saving...' : approve ? 'Approve change request' : 'Dismiss drift'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
